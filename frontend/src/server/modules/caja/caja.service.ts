import { DocumentStatus, DocumentType, PaymentMethod } from '@/generated/prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { sincronizarSalidasDeRecibo } from '../inventario/ventasRecibo';
import { addDays, formatLong, getZonedDayOfWeek, parseZonedDateTime, toZonedDateKey } from '../../lib/datetime';

/**
 * Caja: lo que entró, por medio de pago, y el cierre de cada día.
 *
 * Se cuenta por la fecha del PAGO, no por la del recibo: un saldo que se paga
 * tres días después entra en la caja de ese tercer día.
 */
const LUNES = 1;

export type Periodo = 'dia' | 'semana' | 'mes';

export function rangoDelPeriodo(clave: string, periodo: Periodo): { desde: Date; hasta: Date } {
  const zona = env.CLINIC_TIMEZONE;
  const inicioDelDia = parseZonedDateTime(clave, '00:00', zona);
  // Se suman días y se vuelve a anclar a medianoche: con cambio de hora un día dura 23 o 25 h.
  const medianoche = (base: Date, dias: number) => parseZonedDateTime(toZonedDateKey(addDays(base, dias + 0.5), zona), '00:00', zona);

  if (periodo === 'dia') return { desde: inicioDelDia, hasta: medianoche(inicioDelDia, 1) };

  if (periodo === 'semana') {
    const diaSemana = getZonedDayOfWeek(parseZonedDateTime(clave, '12:00', zona), zona);
    const atras = (diaSemana - LUNES + 7) % 7;
    const lunes = medianoche(inicioDelDia, -atras);
    return { desde: lunes, hasta: medianoche(lunes, 7) };
  }

  const [anio, mes] = clave.split('-').map(Number);
  const primero = parseZonedDateTime(`${anio}-${String(mes).padStart(2, '0')}-01`, '00:00', zona);
  const sigMes = mes === 12 ? 1 : mes + 1;
  const sigAnio = mes === 12 ? anio + 1 : anio;
  return { desde: primero, hasta: parseZonedDateTime(`${sigAnio}-${String(sigMes).padStart(2, '0')}-01`, '00:00', zona) };
}

/** Los recibos guardan la fecha a medianoche UTC: se traduce el rango a esas claves. */
export function rangoDeEmision(desde: Date, hasta: Date): { desde: Date; hasta: Date } {
  const zona = env.CLINIC_TIMEZONE;
  return {
    desde: new Date(`${toZonedDateKey(desde, zona)}T00:00:00.000Z`),
    hasta: new Date(`${toZonedDateKey(hasta, zona)}T00:00:00.000Z`),
  };
}

export interface ResumenCaja {
  desde: string;
  hasta: string;
  cobrado: number;
  cobradoPorMedio: Record<PaymentMethod, number>;
  pagos: number;
  facturado: number;
  documentos: number;
  porCobrar: number;
}

const MEDIOS_EN_CERO = (): Record<PaymentMethod, number> => ({
  EFECTIVO: 0,
  TARJETA: 0,
  ZELLE: 0,
  TRANSFERENCIA: 0,
  FINANCIACION: 0,
  OTRO: 0,
});

export async function resumenCaja(desde: Date, hasta: Date): Promise<ResumenCaja> {
  const emitidas = rangoDeEmision(desde, hasta);
  const delPeriodo = {
    type: DocumentType.RECIBO,
    status: { not: DocumentStatus.ANULADA },
    issueDate: { gte: emitidas.desde, lt: emitidas.hasta },
  };

  const [porMedio, facturado, conteo, pendiente] = await Promise.all([
    prisma.payment.groupBy({
      by: ['method'],
      where: { paidAt: { gte: desde, lt: hasta }, invoice: { status: { not: DocumentStatus.ANULADA } } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.invoice.aggregate({ where: delPeriodo, _sum: { total: true } }),
    prisma.invoice.count({ where: delPeriodo }),
    prisma.invoice.aggregate({ where: { ...delPeriodo, status: DocumentStatus.EMITIDA }, _sum: { balance: true } }),
  ]);

  const cobradoPorMedio = MEDIOS_EN_CERO();
  let cobrado = 0;
  let pagos = 0;
  for (const fila of porMedio) {
    const suma = fila._sum.amount ?? 0;
    cobradoPorMedio[fila.method] = suma;
    cobrado += suma;
    pagos += fila._count._all;
  }

  return {
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    cobrado,
    cobradoPorMedio,
    pagos,
    facturado: facturado._sum.total ?? 0,
    documentos: conteo,
    porCobrar: pendiente._sum.balance ?? 0,
  };
}

export function listarPagos(desde: Date, hasta: Date) {
  return prisma.payment.findMany({
    where: { paidAt: { gte: desde, lt: hasta }, invoice: { status: { not: DocumentStatus.ANULADA } } },
    omit: { patientSignature: true, receivedSignature: true },
    include: {
      invoice: { select: { id: true, number: true, series: true, clientName: true, issueDate: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: [{ paidAt: 'desc' }],
  });
}

type LectorDeCierres = { cashClose: { findUnique: typeof prisma.cashClose.findUnique } };

/**
 * Un día cerrado no admite pagos nuevos ni que se borren los que tiene: el
 * cierre dice lo que se contó en el cajón y tocarlo después lo vuelve mentira.
 */
export async function exigirDiaAbierto(fecha: Date, cliente: LectorDeCierres = prisma, intl = 'en-US') {
  const clave = toZonedDateKey(fecha, env.CLINIC_TIMEZONE);
  const { desde } = rangoDelPeriodo(clave, 'dia');
  const cierre = await cliente.cashClose.findUnique({ where: { closeDate: desde } });
  if (!cierre) return;
  const dia = formatLong(desde, env.CLINIC_TIMEZONE, intl).replace(/,[^,]*$/, '');
  throw HttpError.unprocessable('api.caja.diaCerrado', { dia });
}

export interface PagoEntrada {
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  reference?: string | null;
  notes?: string | null;
  patientSignature?: string | null;
  receivedSignature?: string | null;
  receivedBy?: string | null;
}

export async function registrarPago(invoiceId: string, datos: PagoEntrada, usuarioId?: string) {
  return prisma.$transaction(async (tx) => {
    const recibo = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, type: true, status: true, total: true, deposit: true } });
    if (!recibo) throw HttpError.notFound('api.recibos.noEncontrado');
    if (recibo.type !== DocumentType.RECIBO) throw HttpError.unprocessable('api.recibos.cotizacionNoCobra');
    if (recibo.status === DocumentStatus.ANULADA) throw HttpError.unprocessable('api.recibos.anulado');

    const pendiente = recibo.total - recibo.deposit;
    if (pendiente <= 0) throw HttpError.unprocessable('api.recibos.yaPagado');
    if (datos.amount > pendiente) throw HttpError.unprocessable('api.recibos.superaSaldo', { saldo: (pendiente / 100).toFixed(2) });

    await exigirDiaAbierto(datos.paidAt, tx);

    const pago = await tx.payment.create({
      data: {
        invoiceId: recibo.id,
        amount: datos.amount,
        method: datos.method,
        paidAt: datos.paidAt,
        reference: datos.reference || null,
        notes: datos.notes || null,
        patientSignature: datos.patientSignature || null,
        receivedSignature: datos.receivedSignature || null,
        receivedBy: datos.receivedBy?.trim() || null,
        createdById: usuarioId ?? null,
      },
    });

    const pagado = recibo.deposit + datos.amount;
    const saldo = recibo.total - pagado;
    await tx.invoice.update({
      where: { id: recibo.id },
      data: { deposit: pagado, balance: saldo, status: saldo === 0 ? DocumentStatus.PAGADA : DocumentStatus.EMITIDA },
    });

    await sincronizarSalidasDeRecibo(tx, recibo.id, usuarioId);
    return pago;
  });
}

export async function borrarPago(pagoId: string) {
  return prisma.$transaction(async (tx) => {
    const pago = await tx.payment.findUnique({ where: { id: pagoId }, select: { id: true, amount: true, invoiceId: true, paidAt: true } });
    if (!pago) throw HttpError.notFound('api.caja.pagoNoEncontrado');
    await exigirDiaAbierto(pago.paidAt, tx);

    const recibo = await tx.invoice.findUniqueOrThrow({ where: { id: pago.invoiceId }, select: { total: true, deposit: true, status: true } });
    await tx.payment.delete({ where: { id: pago.id } });

    const pagado = Math.max(0, recibo.deposit - pago.amount);
    const saldo = recibo.total - pagado;
    await tx.invoice.update({
      where: { id: pago.invoiceId },
      data: {
        deposit: pagado,
        balance: saldo,
        ...(recibo.status === DocumentStatus.ANULADA ? {} : { status: saldo === 0 ? DocumentStatus.PAGADA : DocumentStatus.EMITIDA }),
      },
    });

    await sincronizarSalidasDeRecibo(tx, pago.invoiceId);
    return { ok: true };
  });
}

/* -------------------------------------------------------------------------- */

export function cierreDelDia(clave: string) {
  const { desde } = rangoDelPeriodo(clave, 'dia');
  return prisma.cashClose.findUnique({ where: { closeDate: desde }, include: { closedBy: { select: { fullName: true } } } });
}

export function listarCierres(take = 30) {
  return prisma.cashClose.findMany({ include: { closedBy: { select: { fullName: true } } }, orderBy: { closeDate: 'desc' }, take });
}

/** Cierra un día: congela lo que esperaba el sistema y lo que se contó. */
export async function cerrarDia(clave: string, countedCash: number, notes: string | null, usuarioId?: string) {
  const { desde, hasta } = rangoDelPeriodo(clave, 'dia');
  if (await prisma.cashClose.findUnique({ where: { closeDate: desde } })) throw HttpError.conflict('api.caja.yaCerrado');

  const hoy = parseZonedDateTime(toZonedDateKey(new Date(), env.CLINIC_TIMEZONE), '00:00', env.CLINIC_TIMEZONE);
  if (desde > hoy) throw HttpError.badRequest('api.caja.diaFuturo');

  const resumen = await resumenCaja(desde, hasta);
  const efectivo = resumen.cobradoPorMedio.EFECTIVO;

  return prisma.cashClose.create({
    data: {
      closeDate: desde,
      expectedCash: efectivo,
      expectedOther: resumen.cobrado - efectivo,
      expectedTotal: resumen.cobrado,
      countedCash,
      difference: countedCash - efectivo,
      invoiceCount: resumen.documentos,
      invoicedTotal: resumen.facturado,
      notes: notes || null,
      closedById: usuarioId ?? null,
    },
    include: { closedBy: { select: { fullName: true } } },
  });
}

export async function reabrirDia(clave: string) {
  const { desde } = rangoDelPeriodo(clave, 'dia');
  const cierre = await prisma.cashClose.findUnique({ where: { closeDate: desde } });
  if (!cierre) throw HttpError.notFound('api.caja.noCerrado');
  await prisma.cashClose.delete({ where: { id: cierre.id } });
  return { ok: true };
}


/** Pagos que entraron en el periodo pero son de recibos emitidos en otro. */
export async function abonosDeOtrosDias(desde: Date, hasta: Date) {
  const emitidas = rangoDeEmision(desde, hasta);
  const filas = await prisma.payment.findMany({
    where: {
      paidAt: { gte: desde, lt: hasta },
      invoice: {
        status: { not: DocumentStatus.ANULADA },
        OR: [{ issueDate: { lt: emitidas.desde } }, { issueDate: { gte: emitidas.hasta } }],
      },
    },
    include: {
      invoice: { select: { id: true, series: true, number: true, clientName: true, issueDate: true, total: true, balance: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: [{ paidAt: 'desc' }],
  });
  return filas.map((f) => ({
    id: f.id,
    paidAt: f.paidAt.toISOString(),
    amount: f.amount,
    method: f.method,
    reference: f.reference ?? null,
    recibio: f.createdBy?.fullName ?? null,
    recibo: { ...f.invoice, issueDate: f.invoice.issueDate.toISOString() },
  }));
}
