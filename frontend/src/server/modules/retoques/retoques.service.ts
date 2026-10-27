import { AppointmentStatus, type TouchUpStatus } from '@/generated/prisma/client';
import type { Locale } from '@/i18n/routing';
import { localeDeEnum } from '@/lib/idiomas';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { toZonedDateKey } from '../../lib/datetime';
import { traducirServicio } from '../treatments/traduccion';

/**
 * Retoques: quién ya debe volver.
 *
 * NO se guardan: se calculan. Por cada clienta y tratamiento se toma la ÚLTIMA
 * vez que se le hizo —un mapa facial, una sesión de la ficha de piel o una
 * cita completada— y se le suma el «retoque cada N días» del tratamiento
 * (toxina ~90, rellenos ~270, boosters ~28).
 *
 * Sale de la lista si:
 *  · ya tiene una cita próxima de ese tratamiento o de su misma familia, o
 *  · el equipo ya la marcó (contactada o descartada) para ESA última vez.
 *    Si se vuelve a tratar, la fecha base cambia y el retoque nuevo sale solo.
 */
const DIA_MS = 86_400_000;

/** Se avisa con una semana de margen: «ya le toca o le toca esta semana». */
export const DIAS_DE_MARGEN = 7;

export interface Retoque {
  clave: string;
  patientId: string;
  patientName: string;
  phone: string;
  email: string | null;
  preferredLocale: Locale;
  serviceId: string;
  serviceName: string;
  /** El nombre del tratamiento en el idioma de la clienta (para su mensaje). */
  serviceNameClienta: string;
  category: string;
  /** Día de la última vez (AAAA-MM-DD): lo que se manda al marcarlo. */
  baseDate: string;
  ultimaVez: Date;
  tocaEl: Date;
  diasDeRetraso: number;
}

type Ultima = Map<string, Date>; // `${patientId}|${serviceId}` → fecha

function anotar(mapa: Ultima, patientId: string | null, serviceId: string | null, fecha: Date | null) {
  if (!patientId || !serviceId || !fecha) return;
  const clave = `${patientId}|${serviceId}`;
  const previa = mapa.get(clave);
  if (!previa || previa < fecha) mapa.set(clave, fecha);
}

export async function calcularRetoques(opciones: { patientId?: string; locale?: Locale; margenDias?: number; todos?: boolean } = {}): Promise<Retoque[]> {
  const ahora = new Date();
  const margen = opciones.margenDias ?? DIAS_DE_MARGEN;
  const filtroClienta = opciones.patientId ? { patientId: opciones.patientId } : {};

  const servicios = await prisma.service.findMany({ where: { touchUpDays: { not: null } } });
  if (!servicios.length) return [];
  const porId = new Map(servicios.map((s) => [s.id, s]));
  const ids = servicios.map((s) => s.id);

  const [citas, mapas, sesionesPiel, proximas, marcas] = await Promise.all([
    prisma.appointment.groupBy({
      by: ['patientId', 'serviceId'],
      where: { ...filtroClienta, status: AppointmentStatus.COMPLETADA, serviceId: { in: ids }, patientId: { not: null } },
      _max: { startsAt: true },
    }),
    prisma.clinicalRecord.groupBy({
      by: ['patientId', 'serviceId'],
      where: { ...filtroClienta, serviceId: { in: ids } },
      _max: { procedureDate: true },
    }),
    prisma.facialEntry.findMany({
      where: { serviceId: { in: ids }, record: opciones.patientId ? { patientId: opciones.patientId } : {} },
      select: { serviceId: true, sessionDate: true, record: { select: { patientId: true } } },
    }),
    prisma.appointment.findMany({
      where: {
        ...filtroClienta,
        startsAt: { gte: ahora },
        status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
        patientId: { not: null },
      },
      select: { patientId: true, serviceId: true, service: { select: { category: true } } },
    }),
    prisma.touchUpMark.findMany({ where: filtroClienta, select: { patientId: true, serviceId: true, baseDate: true } }),
  ]);

  const ultima: Ultima = new Map();
  for (const c of citas) anotar(ultima, c.patientId, c.serviceId, c._max.startsAt);
  for (const m of mapas) anotar(ultima, m.patientId, m.serviceId, m._max.procedureDate);
  for (const s of sesionesPiel) anotar(ultima, s.record.patientId, s.serviceId, s.sessionDate);

  const conCita = new Set(proximas.flatMap((p) => [`${p.patientId}|${p.serviceId}`, `${p.patientId}|cat:${p.service.category}`]));
  const marcadas = new Set(marcas.map((m) => `${m.patientId}|${m.serviceId}|${m.baseDate.toISOString().slice(0, 10)}`));

  const candidatas: Array<{ patientId: string; serviceId: string; ultimaVez: Date; tocaEl: Date }> = [];
  for (const [clave, fecha] of ultima) {
    const [patientId, serviceId] = clave.split('|');
    const servicio = porId.get(serviceId);
    if (!servicio?.touchUpDays) continue;
    const tocaEl = new Date(fecha.getTime() + servicio.touchUpDays * DIA_MS);
    if (!opciones.todos && tocaEl.getTime() > ahora.getTime() + margen * DIA_MS) continue;
    if (conCita.has(clave) || conCita.has(`${patientId}|cat:${servicio.category}`)) continue;
    if (marcadas.has(`${clave}|${fecha.toISOString().slice(0, 10)}`)) continue;
    candidatas.push({ patientId, serviceId, ultimaVez: fecha, tocaEl });
  }
  if (!candidatas.length) return [];

  const clientas = await prisma.patient.findMany({
    where: { id: { in: [...new Set(candidatas.map((c) => c.patientId))] }, active: true },
    select: { id: true, fullName: true, phone: true, email: true, preferredLocale: true },
  });
  const clientaPorId = new Map(clientas.map((c) => [c.id, c]));

  return candidatas
    .filter((c) => clientaPorId.has(c.patientId))
    .map((c) => {
      const clienta = clientaPorId.get(c.patientId)!;
      const servicio = traducirServicio(porId.get(c.serviceId)!, opciones.locale ?? 'es');
      const suIdioma = localeDeEnum(clienta.preferredLocale);
      return {
        clave: `${c.patientId}|${c.serviceId}|${c.ultimaVez.toISOString().slice(0, 10)}`,
        patientId: c.patientId,
        patientName: clienta.fullName,
        phone: clienta.phone,
        email: clienta.email,
        preferredLocale: suIdioma,
        serviceId: c.serviceId,
        serviceName: servicio.name,
        serviceNameClienta: traducirServicio(porId.get(c.serviceId)!, suIdioma).name,
        category: servicio.category,
        baseDate: c.ultimaVez.toISOString().slice(0, 10),
        ultimaVez: c.ultimaVez,
        tocaEl: c.tocaEl,
        diasDeRetraso: Math.floor((ahora.getTime() - c.tocaEl.getTime()) / DIA_MS),
      };
    })
    .sort((a, b) => a.tocaEl.getTime() - b.tocaEl.getTime());
}

/** Marca un retoque como contactado o descartado (para esa última vez). */
export async function marcarRetoque(datos: {
  patientId: string;
  serviceId: string;
  baseDate: string;
  status: TouchUpStatus;
  notes?: string | null;
  byId?: string;
}) {
  const base = new Date(`${datos.baseDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) throw HttpError.badRequest('api.general.solicitudInvalida');
  // La fecha base se guarda como el día (UTC) de la última vez, igual que la clave.
  return prisma.touchUpMark.upsert({
    where: { patientId_serviceId_baseDate: { patientId: datos.patientId, serviceId: datos.serviceId, baseDate: base } },
    create: {
      patientId: datos.patientId,
      serviceId: datos.serviceId,
      baseDate: base,
      status: datos.status,
      notes: datos.notes ?? null,
      byId: datos.byId ?? null,
    },
    update: { status: datos.status, notes: datos.notes ?? null, byId: datos.byId ?? null },
  });
}

export function hoyClave(): string {
  return toZonedDateKey(new Date(), env.CLINIC_TIMEZONE);
}
