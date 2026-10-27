import type { Prisma, SkinType } from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { comprobarFilasPropias, comprobarMismoPaciente, comprobarVersion, crearUnaVez, versionTomada } from '../../lib/envioUnico';
import { sincronizarUso } from '../inventario/inventario.service';
import { cancelarCitasDeControl, sincronizarProximoControl, type AvisoAgenda } from '../agenda/proximoControl';

/**
 * Ficha de piel (Fitzpatrick): peelings, micropunción, boosters, faciales.
 * Las inyecciones van en el mapa facial. Cada sesión puede descontar un
 * producto de un lote y agendar su próximo control.
 */
export interface SesionEntrada {
  id?: string;
  sessionDate: Date;
  sessionLabel?: string | null;
  serviceId?: string | null;
  zones: string[];
  productId?: string | null;
  productName?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  technique?: string | null;
  findings?: string | null;
  homeCare?: string | null;
  nextControl?: Date | null;
  nextControlTime?: string | null;
  nextControlServiceId?: string | null;
  professionalSignature?: string | null;
  patientSignature?: string | null;
}

export interface FichaPielEntrada {
  patientId: string;
  openedAt: Date;
  patientName: string;
  patientAge?: number | null;
  patientPhone?: string | null;
  skinType?: SkinType | null;
  skinCondition?: string | null;
  concerns: string[];
  allergies?: string | null;
  contraindications?: string | null;
  notes?: string | null;
  entries: SesionEntrada[];
  version?: string | null;
  claveDeEnvio?: string | null;
}

const CON_TODO = {
  patient: { select: { id: true, fullName: true, phone: true, preferredLocale: true } },
  createdBy: { select: { fullName: true } },
  entries: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      service: { select: { id: true, name: true } },
      nextControlService: { select: { id: true, name: true } },
      nextControlAppointment: { select: { id: true, startsAt: true, status: true } },
      product: { select: { id: true, name: true, unit: true, applicationUnit: true } },
      lot: { select: { id: true, lotNumber: true, expiresAt: true } },
    },
  },
} satisfies Prisma.FacialRecordInclude;

async function datosDeSesion(tx: Prisma.TransactionClient, s: SesionEntrada, indice: number) {
  let productName = s.productName?.trim() || null;
  let lotNumber = s.lotNumber?.trim() || null;
  let productId = s.productId || null;
  const lotId = s.lotId || null;
  if (productId) {
    const p = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
    if (!p) throw HttpError.unprocessable('api.mapa.productoNoExiste');
    productName = p.name;
  }
  if (lotId) {
    const l = await tx.lot.findUnique({ where: { id: lotId }, select: { productId: true, lotNumber: true } });
    if (!l || (productId && l.productId !== productId)) throw HttpError.unprocessable('api.mapa.loteNoEsDelProducto');
    productId = l.productId;
    lotNumber = l.lotNumber;
  }
  return {
    sessionDate: s.sessionDate,
    sessionLabel: s.sessionLabel?.trim() || null,
    serviceId: s.serviceId || null,
    zones: s.zones,
    productId,
    productName,
    lotId,
    lotNumber,
    quantity: s.quantity ?? null,
    quantityUnit: s.quantityUnit?.trim() || null,
    technique: s.technique?.trim() || null,
    findings: s.findings?.trim() || null,
    homeCare: s.homeCare?.trim() || null,
    nextControl: s.nextControl ?? null,
    nextControlTime: s.nextControlTime?.trim() || null,
    nextControlServiceId: s.nextControlServiceId || null,
    professionalSignature: s.professionalSignature ?? null,
    patientSignature: s.patientSignature ?? null,
    sortOrder: indice,
  };
}

function cabecera(datos: FichaPielEntrada) {
  return {
    openedAt: datos.openedAt,
    patientName: datos.patientName.trim(),
    patientAge: datos.patientAge ?? null,
    patientPhone: datos.patientPhone?.trim() || null,
    skinType: datos.skinType || null,
    skinCondition: datos.skinCondition?.trim() || null,
    concerns: datos.concerns,
    allergies: datos.allergies?.trim() || null,
    contraindications: datos.contraindications?.trim() || null,
    notes: datos.notes?.trim() || null,
  };
}

async function sincronizarInventario(tx: Prisma.TransactionClient, recordId: string, usuarioId?: string) {
  const ficha = await tx.facialRecord.findUniqueOrThrow({ where: { id: recordId }, select: { patientId: true, entries: true } });
  for (const s of ficha.entries) {
    await sincronizarUso(
      tx,
      { productId: s.productId, lotId: s.lotId, cantidadAplicada: s.quantity ?? 0, patientId: ficha.patientId, occurredAt: s.sessionDate, usuarioId },
      { facialEntryId: s.id },
    );
  }
}

async function agendarControles(recordId: string): Promise<AvisoAgenda[]> {
  const ficha = await prisma.facialRecord.findUnique({
    where: { id: recordId },
    include: { patient: { select: { id: true, phone: true, preferredLocale: true } }, entries: { include: { nextControlAppointment: true } } },
  });
  if (!ficha) return [];
  const avisos: AvisoAgenda[] = [];
  for (const s of ficha.entries) {
    const { appointmentId, aviso } = await sincronizarProximoControl({
      fecha: s.nextControl,
      hora: s.nextControlTime,
      serviceId: s.nextControlServiceId,
      citaActual: s.nextControlAppointment,
      paciente: { id: ficha.patientId, nombre: ficha.patientName, telefono: ficha.patientPhone ?? ficha.patient.phone, locale: ficha.patient.preferredLocale },
      nota: `↻ ${s.sessionDate.toISOString().slice(0, 10)}`,
    });
    if (appointmentId !== s.nextControlAppointmentId) {
      await prisma.facialEntry.update({ where: { id: s.id }, data: { nextControlAppointmentId: appointmentId }, select: { id: true } });
    }
    if (aviso) avisos.push(aviso);
  }
  return avisos;
}

export async function crear(datos: FichaPielEntrada, createdById?: string) {
  const paciente = await prisma.patient.findUnique({ where: { id: datos.patientId }, select: { id: true } });
  if (!paciente) throw HttpError.notFound('api.clientas.noEncontrada');

  const resultado = await crearUnaVez('piel', datos.claveDeEnvio, () =>
    prisma.$transaction(
      async (tx) => {
        const sesiones = [];
        for (const [i, s] of datos.entries.entries()) sesiones.push(await datosDeSesion(tx, s, i));
        const ficha = await tx.facialRecord.create({
          data: { ...cabecera(datos), patientId: datos.patientId, createdById: createdById ?? null, entries: { create: sesiones } },
          select: { id: true },
        });
        await sincronizarInventario(tx, ficha.id, createdById);
        return ficha;
      },
      { timeout: 20_000, maxWait: 10_000 },
    ),
  );
  if (resultado.repetida) return { ficha: await obtener(resultado.idPrevio), avisos: [] as AvisoAgenda[] };
  const avisos = await agendarControles(resultado.creada.id);
  return { ficha: await obtener(resultado.creada.id), avisos };
}

export async function actualizar(id: string, datos: FichaPielEntrada, usuarioId?: string) {
  const existente = await prisma.facialRecord.findUnique({
    where: { id },
    select: { id: true, patientId: true, updatedAt: true, entries: { select: { id: true, nextControlAppointmentId: true } } },
  });
  if (!existente) throw HttpError.notFound('api.piel.noEncontrada');
  comprobarVersion(datos.version, existente.updatedAt);
  comprobarMismoPaciente(datos.patientId, existente.patientId);
  const propias = comprobarFilasPropias(
    existente.entries.map((e) => e.id),
    datos.entries.map((e) => e.id),
  );
  const quitadas = existente.entries.filter((e) => !propias.has(e.id));

  await prisma.$transaction(
    async (tx) => {
      const { count } = await tx.facialRecord.updateMany({
        where: { id, updatedAt: existente.updatedAt },
        data: { ...cabecera(datos), updatedAt: new Date() },
      });
      versionTomada(count);
      for (const q of quitadas) await sincronizarUso(tx, null, { facialEntryId: q.id });
      if (quitadas.length) await tx.facialEntry.deleteMany({ where: { id: { in: quitadas.map((q) => q.id) } } });
      for (const [i, s] of datos.entries.entries()) {
        const d = await datosDeSesion(tx, s, i);
        if (s.id) await tx.facialEntry.update({ where: { id: s.id }, data: d });
        else await tx.facialEntry.create({ data: { ...d, recordId: id } });
      }
      await sincronizarInventario(tx, id, usuarioId);
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  await cancelarCitasDeControl(quitadas.map((q) => q.nextControlAppointmentId).filter((v): v is string => Boolean(v)));
  const avisos = await agendarControles(id);
  return { ficha: await obtener(id), avisos };
}

export async function obtener(id: string) {
  const ficha = await prisma.facialRecord.findUnique({ where: { id }, include: CON_TODO });
  if (!ficha) throw HttpError.notFound('api.piel.noEncontrada');
  return ficha;
}

export async function borrar(id: string) {
  const ficha = await prisma.facialRecord.findUnique({ where: { id }, select: { entries: { select: { id: true, nextControlAppointmentId: true } } } });
  if (!ficha) throw HttpError.notFound('api.piel.noEncontrada');
  await prisma.$transaction(async (tx) => {
    for (const s of ficha.entries) await sincronizarUso(tx, null, { facialEntryId: s.id });
    await tx.facialRecord.delete({ where: { id } });
  });
  await cancelarCitasDeControl(ficha.entries.map((s) => s.nextControlAppointmentId).filter((v): v is string => Boolean(v)));
  return { ok: true };
}
