import { AppointmentStatus, FaceView, type Prisma } from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { fechaDesdeClave } from '../../lib/fechaDia';
import { variantesDeAcento } from '../../lib/acentos';
import { comprobarFilasPropias, comprobarMismoPaciente, comprobarVersion, crearUnaVez, versionTomada } from '../../lib/envioUnico';
import { sincronizarUso } from '../inventario/inventario.service';
import { cancelarCitasDeControl, sincronizarProximoControl, type AvisoAgenda } from '../agenda/proximoControl';

/**
 * Mapa facial de aplicación (toxina y rellenos).
 *
 * Reemplaza el control capilar de Dermocapilar. Cada visita es una hoja con
 * el rostro (una foto propia o la plantilla dibujada) y sus PUNTOS: dónde,
 * qué producto, cuántas unidades o mL, de qué lote y vencimiento, y quién lo
 * aplicó. Cada punto descuenta del lote en el inventario.
 */

export interface PuntoEntrada {
  id?: string | null;
  view: FaceView;
  x: number;
  y: number;
  zone: string;
  productId?: string | null;
  productName?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  expiresAt?: string | null;
  quantity: number;
  unit: string;
  technique?: string | null;
  notes?: string | null;
  appliedById?: string | null;
}

export interface MapaEntrada {
  patientId: string;
  procedureDate: string;
  serviceId?: string | null;
  appointmentId?: string | null;
  patientName: string;
  patientAge?: number | null;
  patientPhone?: string | null;
  facePhotoUrl?: string | null;
  notes?: string | null;
  aftercare?: string | null;
  nextControl?: string | null;
  nextControlTime?: string | null;
  nextControlServiceId?: string | null;
  professionalSignature?: string | null;
  patientSignature?: string | null;
  entries: PuntoEntrada[];
  version?: string | null;
  claveDeEnvio?: string | null;
}

const limpio = (valor: string | null | undefined) => valor?.trim() || null;

const CON_DETALLE = {
  entries: {
    orderBy: { sortOrder: 'asc' },
    include: {
      product: { select: { id: true, name: true, kind: true, applicationUnit: true } },
      lot: { select: { id: true, lotNumber: true, expiresAt: true, blocked: true } },
      appliedBy: { select: { id: true, fullName: true } },
    },
  },
  patient: { select: { id: true, fullName: true, phone: true, preferredLocale: true, allergies: true, medications: true, pregnancy: true, birthDate: true } },
  service: { select: { id: true, name: true, category: true } },
  nextControlService: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ClinicalRecordInclude;

/**
 * Normaliza los puntos: el nombre del producto y el número/vencimiento del
 * lote se COPIAN del inventario (si se eligió de ahí), para que la historia
 * siga diciendo lo mismo aunque el catálogo cambie.
 */
async function prepararPuntos(entries: PuntoEntrada[], tx: Prisma.TransactionClient) {
  const usuarios = new Map(
    (await tx.user.findMany({ where: { id: { in: entries.map((e) => e.appliedById).filter((v): v is string => Boolean(v)) } }, select: { id: true, fullName: true } })).map(
      (u) => [u.id, u.fullName],
    ),
  );
  const salida = [];
  for (const [indice, p] of entries.entries()) {
    let productName = limpio(p.productName);
    let lotNumber = limpio(p.lotNumber);
    let expiresAt = p.expiresAt ? fechaDesdeClave(p.expiresAt) : null;
    let productId = p.productId || null;
    let lotId = p.lotId || null;
    if (productId) {
      const producto = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
      if (!producto) throw HttpError.unprocessable('api.mapa.productoNoExiste');
      productName = producto.name;
    }
    if (lotId) {
      const lote = await tx.lot.findUnique({ where: { id: lotId }, select: { productId: true, lotNumber: true, expiresAt: true } });
      if (!lote || (productId && lote.productId !== productId)) throw HttpError.unprocessable('api.mapa.loteNoEsDelProducto');
      productId = lote.productId;
      lotNumber = lote.lotNumber;
      expiresAt = lote.expiresAt;
    } else {
      lotId = null;
    }
    if (!productName) throw HttpError.unprocessable('api.mapa.faltaProducto', { n: indice + 1 });
    salida.push({
      view: p.view,
      x: Math.min(100, Math.max(0, p.x)),
      y: Math.min(100, Math.max(0, p.y)),
      zone: p.zone.trim(),
      productId,
      productName,
      lotId,
      lotNumber,
      expiresAt,
      quantity: Math.round(p.quantity * 1000) / 1000,
      unit: p.unit.trim(),
      technique: limpio(p.technique),
      notes: limpio(p.notes),
      appliedById: p.appliedById || null,
      appliedByName: p.appliedById ? (usuarios.get(p.appliedById) ?? null) : null,
      sortOrder: indice,
    });
  }
  return salida;
}

function prepararCabecera(datos: MapaEntrada) {
  return {
    procedureDate: fechaDesdeClave(datos.procedureDate),
    serviceId: datos.serviceId || null,
    patientName: datos.patientName.trim(),
    patientAge: datos.patientAge ?? null,
    patientPhone: limpio(datos.patientPhone),
    facePhotoUrl: limpio(datos.facePhotoUrl),
    notes: limpio(datos.notes),
    aftercare: limpio(datos.aftercare),
    nextControl: datos.nextControl ? fechaDesdeClave(datos.nextControl) : null,
    nextControlTime: limpio(datos.nextControlTime),
    nextControlServiceId: datos.nextControlServiceId || null,
    ...(datos.professionalSignature !== undefined ? { professionalSignature: datos.professionalSignature } : {}),
    ...(datos.patientSignature !== undefined ? { patientSignature: datos.patientSignature } : {}),
  };
}

/** Deja las salidas de inventario de cada punto como dicen los puntos. */
async function sincronizarInventario(tx: Prisma.TransactionClient, recordId: string, usuarioId?: string) {
  const ficha = await tx.clinicalRecord.findUniqueOrThrow({ where: { id: recordId }, select: { patientId: true, procedureDate: true, entries: true } });
  // La salida se fecha a mediodía del día del procedimiento.
  const cuando = new Date(ficha.procedureDate.getTime() + 12 * 3_600_000);
  for (const punto of ficha.entries) {
    await sincronizarUso(
      tx,
      {
        productId: punto.productId,
        lotId: punto.lotId,
        cantidadAplicada: punto.quantity,
        patientId: ficha.patientId,
        occurredAt: cuando,
        usuarioId,
      },
      { clinicalEntryId: punto.id },
    );
  }
}

/** Si el mapa viene de una cita, la cita queda como atendida. */
async function completarCita(appointmentId: string | null | undefined) {
  if (!appointmentId) return;
  await prisma.appointment
    .updateMany({
      where: { id: appointmentId, status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] } },
      data: { status: AppointmentStatus.COMPLETADA },
    })
    .catch(() => {});
}

async function agendarControl(recordId: string): Promise<AvisoAgenda[]> {
  const ficha = await prisma.clinicalRecord.findUnique({
    where: { id: recordId },
    include: { patient: { select: { id: true, fullName: true, phone: true, preferredLocale: true } } },
  });
  if (!ficha) return [];
  const actual = ficha.nextControlAppointmentId
    ? await prisma.appointment.findUnique({ where: { id: ficha.nextControlAppointmentId }, select: { id: true, status: true, serviceId: true, startsAt: true } })
    : null;
  const { appointmentId, aviso } = await sincronizarProximoControl({
    fecha: ficha.nextControl,
    hora: ficha.nextControlTime,
    serviceId: ficha.nextControlServiceId,
    citaActual: actual,
    paciente: { id: ficha.patientId, nombre: ficha.patientName, telefono: ficha.patientPhone ?? ficha.patient.phone, locale: ficha.patient.preferredLocale },
    nota: `↻ ${ficha.procedureDate.toISOString().slice(0, 10)}`,
  });
  if (appointmentId !== ficha.nextControlAppointmentId) {
    await prisma.clinicalRecord.update({ where: { id: recordId }, data: { nextControlAppointmentId: appointmentId }, select: { id: true } });
  }
  return aviso ? [aviso] : [];
}

export async function crear(datos: MapaEntrada, createdById?: string) {
  const paciente = await prisma.patient.findUnique({ where: { id: datos.patientId }, select: { id: true } });
  if (!paciente) throw HttpError.unprocessable('api.clientas.noEncontrada');

  const resultado = await crearUnaVez('mapa', datos.claveDeEnvio, () =>
    prisma.$transaction(
      async (tx) => {
        const ficha = await tx.clinicalRecord.create({
          data: {
            ...prepararCabecera(datos),
            patientId: datos.patientId,
            appointmentId: datos.appointmentId || null,
            createdById: createdById ?? null,
            entries: { create: await prepararPuntos(datos.entries, tx) },
          },
          select: { id: true },
        });
        await sincronizarInventario(tx, ficha.id, createdById);
        return ficha;
      },
      { timeout: 20_000, maxWait: 10_000 },
    ),
  );
  if (resultado.repetida) return { ficha: await obtener(resultado.idPrevio), avisos: [] as AvisoAgenda[] };

  await completarCita(datos.appointmentId);
  const avisos = await agendarControl(resultado.creada.id);
  return { ficha: await obtener(resultado.creada.id), avisos };
}

export async function actualizar(id: string, datos: MapaEntrada, usuarioId?: string) {
  const existente = await prisma.clinicalRecord.findUnique({ where: { id }, include: { entries: { select: { id: true } } } });
  if (!existente) throw HttpError.notFound('api.mapa.noEncontrado');
  comprobarVersion(datos.version, existente.updatedAt);
  comprobarMismoPaciente(datos.patientId, existente.patientId);
  const propias = comprobarFilasPropias(
    existente.entries.map((e) => e.id),
    datos.entries.map((e) => e.id),
  );
  const quitadas = existente.entries.filter((e) => !propias.has(e.id)).map((e) => e.id);

  await prisma.$transaction(
    async (tx) => {
      const { count } = await tx.clinicalRecord.updateMany({ where: { id, updatedAt: existente.updatedAt }, data: { updatedAt: new Date() } });
      versionTomada(count);

      // Los puntos quitados devuelven al inventario lo que habían sacado.
      for (const idPunto of quitadas) await sincronizarUso(tx, null, { clinicalEntryId: idPunto });
      if (quitadas.length) await tx.clinicalEntry.deleteMany({ where: { id: { in: quitadas } } });

      const preparados = await prepararPuntos(datos.entries, tx);
      for (const [indice, punto] of preparados.entries()) {
        const idPunto = datos.entries[indice].id;
        if (idPunto) await tx.clinicalEntry.update({ where: { id: idPunto }, data: punto });
        else await tx.clinicalEntry.create({ data: { ...punto, recordId: id } });
      }

      await tx.clinicalRecord.update({ where: { id }, data: prepararCabecera(datos) });
      await sincronizarInventario(tx, id, usuarioId);
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  const avisos = await agendarControl(id);
  return { ficha: await obtener(id), avisos };
}

export async function obtener(id: string) {
  const ficha = await prisma.clinicalRecord.findUnique({ where: { id }, include: { ...CON_DETALLE, appointment: { select: { id: true, startsAt: true } } } });
  if (!ficha) throw HttpError.notFound('api.mapa.noEncontrado');
  const control = ficha.nextControlAppointmentId
    ? await prisma.appointment.findUnique({ where: { id: ficha.nextControlAppointmentId }, select: { id: true, startsAt: true, status: true } })
    : null;
  return { ...ficha, nextControlAppointment: control };
}

/** Borrar un mapa devuelve al inventario lo aplicado y cancela su próximo control. */
export async function eliminar(id: string, usuarioId?: string) {
  const ficha = await prisma.clinicalRecord.findUnique({ where: { id }, select: { nextControlAppointmentId: true, entries: { select: { id: true } } } });
  if (!ficha) throw HttpError.notFound('api.mapa.noEncontrado');
  await prisma.$transaction(async (tx) => {
    for (const p of ficha.entries) await sincronizarUso(tx, null, { clinicalEntryId: p.id });
    await tx.clinicalRecord.delete({ where: { id } });
  });
  void usuarioId;
  if (ficha.nextControlAppointmentId) await cancelarCitasDeControl([ficha.nextControlAppointmentId]);
}

/* -------------------------------------------------------------------------- */

function palabras(q: string | undefined): string[] {
  return (q ?? '').trim().split(/\s+/).filter(Boolean);
}

export type TipoDeFicha = 'MAPA' | 'PIEL';

/** Lista unificada: mapas faciales y fichas de piel, lo más reciente primero. */
export async function listar(filtro: { q?: string; patientId?: string; tipo?: TipoDeFicha; take: number; skip: number }) {
  const hasta = filtro.take + filtro.skip;
  const condiciones = palabras(filtro.q).map((p) => ({
    OR: variantesDeAcento(p).flatMap((v) => [
      { patientName: { contains: v, mode: 'insensitive' as const } },
      { patientPhone: { contains: v.replace(/\D/g, '') || v } },
    ]),
  }));
  const base = { ...(filtro.patientId ? { patientId: filtro.patientId } : {}), ...(condiciones.length ? { AND: condiciones } : {}) };

  const [mapas, totalMapas, pieles, totalPieles] = await Promise.all([
    filtro.tipo === 'PIEL'
      ? []
      : prisma.clinicalRecord.findMany({
          where: base,
          include: {
            patient: { select: { id: true, fullName: true } },
            service: { select: { name: true } },
            _count: { select: { entries: true } },
            entries: { select: { quantity: true, unit: true } },
          },
          orderBy: [{ procedureDate: 'desc' }, { createdAt: 'desc' }],
          take: hasta,
        }),
    filtro.tipo === 'PIEL' ? 0 : prisma.clinicalRecord.count({ where: base }),
    filtro.tipo === 'MAPA'
      ? []
      : prisma.facialRecord.findMany({
          where: base,
          include: { patient: { select: { id: true, fullName: true } }, _count: { select: { entries: true } } },
          orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }],
          take: hasta,
        }),
    filtro.tipo === 'MAPA' ? 0 : prisma.facialRecord.count({ where: base }),
  ]);

  const unidas = [
    ...mapas.map((m) => {
      const totales: Record<string, number> = {};
      for (const e of m.entries) totales[e.unit] = Math.round(((totales[e.unit] ?? 0) + e.quantity) * 100) / 100;
      return {
        id: m.id,
        tipo: 'MAPA' as const,
        fecha: m.procedureDate,
        createdAt: m.createdAt,
        patientName: m.patientName,
        patientPhone: m.patientPhone,
        patient: m.patient,
        servicio: m.service?.name ?? null,
        detalle: m._count.entries,
        totales,
      };
    }),
    ...pieles.map((f) => ({
      id: f.id,
      tipo: 'PIEL' as const,
      fecha: f.openedAt,
      createdAt: f.createdAt,
      patientName: f.patientName,
      patientPhone: f.patientPhone,
      patient: f.patient,
      servicio: f.skinCondition,
      detalle: f._count.entries,
      totales: {} as Record<string, number>,
    })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.createdAt.getTime() - a.createdAt.getTime());

  return { items: unidas.slice(filtro.skip, hasta), total: totalMapas + totalPieles, take: filtro.take, skip: filtro.skip };
}
