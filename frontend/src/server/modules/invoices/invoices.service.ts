import { DocumentStatus, DocumentType, PaymentMethod, Prisma, type Idioma } from '@/generated/prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { parseZonedDateTime, toZonedDateKey } from '../../lib/datetime';
import { condicionPorNumero } from '../../lib/numeroDeDocumento';
import { variantesDeAcento } from '../../lib/acentos';
import * as caja from '../caja/caja.service';
import { sincronizarSalidasDeRecibo } from '../inventario/ventasRecibo';

/**
 * Recibos y cotizaciones, en USD (centavos enteros).
 *
 * IMPUESTOS: pendientes de confirmar con la clínica. Cada documento lleva su
 * tasa (`taxRateBps`, 825 = 8,25 %) que se aplica sobre (subtotal − descuento);
 * el valor por defecto sale de Configuración y hoy es 0.
 */
export interface LineaEntrada {
  quantity: number;
  description: string;
  unitPrice: number;
  productId?: string | null;
}

export interface DocumentoEntrada {
  type: DocumentType;
  issueDate: Date;
  patientId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  locale?: Idioma;
  items: LineaEntrada[];
  discount?: number;
  taxRateBps?: number;
  deposit?: number;
  depositMethod?: PaymentMethod;
  notes?: string | null;
  signature?: string | null;
  signedBy?: string | null;
}

/** Totales en centavos. El impuesto se redondea al centavo (mitad hacia arriba). */
export function calcularTotales(items: LineaEntrada[], discount = 0, taxRateBps = 0, pagado = 0) {
  const lineas = items.map((item, indice) => ({
    quantity: item.quantity,
    description: item.description.trim(),
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
    sortOrder: indice,
    productId: item.productId ?? null,
  }));
  const subtotal = lineas.reduce((s, l) => s + l.total, 0);
  const base = Math.max(0, subtotal - discount);
  const tax = Math.round((base * taxRateBps) / 10_000);
  const total = base + tax;
  const balance = Math.max(0, total - pagado);
  return { lineas, subtotal, tax, total, balance };
}

/**
 * Consecutivo atómico en `settings`: dos recibos a la vez no pueden quedarse
 * con el mismo número (un MAX()+1 sí lo permitiría).
 */
async function siguienteNumero(tx: Prisma.TransactionClient): Promise<number> {
  const filas = await tx.$queryRaw<Array<{ value: string }>>`
    INSERT INTO settings (key, value, "updatedAt")
    VALUES ('invoice_counter', '1', now())
    ON CONFLICT (key) DO UPDATE
      SET value = (settings.value::int + 1)::text, "updatedAt" = now()
    RETURNING value
  `;
  const numero = Number.parseInt(filas[0]?.value ?? '', 10);
  if (!Number.isInteger(numero) || numero < 1) throw HttpError.serviceUnavailable('api.recibos.sinNumero');
  return numero;
}

/** El abono al emitir entra AHORA si el recibo es de hoy; si es de otro día, a mediodía de ese día. */
function momentoDelAbono(issueDate: Date): Date {
  const zona = env.CLINIC_TIMEZONE;
  const dia = issueDate.toISOString().slice(0, 10);
  const ahora = new Date();
  return toZonedDateKey(ahora, zona) === dia ? ahora : parseZonedDateTime(dia, '12:00', zona);
}

export async function crear(datos: DocumentoEntrada, createdById?: string) {
  if (datos.items.length === 0) throw HttpError.unprocessable('api.recibos.sinLineas');

  const abono = datos.type === DocumentType.RECIBO ? (datos.deposit ?? 0) : 0;
  const { lineas, subtotal, tax, total, balance } = calcularTotales(datos.items, datos.discount ?? 0, datos.taxRateBps ?? 0, abono);
  if (abono > total) throw HttpError.unprocessable('api.recibos.abonoMayor');
  const cobradoEn = momentoDelAbono(datos.issueDate);

  return prisma.$transaction(async (tx) => {
    if (abono > 0) await caja.exigirDiaAbierto(cobradoEn, tx);
    const number = await siguienteNumero(tx);

    const documento = await tx.invoice.create({
      data: {
        number,
        type: datos.type,
        status: abono > 0 && balance === 0 ? DocumentStatus.PAGADA : DocumentStatus.EMITIDA,
        issueDate: datos.issueDate,
        patientId: datos.patientId ?? null,
        clientName: datos.clientName.trim(),
        clientEmail: datos.clientEmail?.trim().toLowerCase() || null,
        clientPhone: datos.clientPhone?.trim() || null,
        ...(datos.locale ? { locale: datos.locale } : {}),
        subtotal,
        discount: datos.discount ?? 0,
        taxRateBps: datos.taxRateBps ?? 0,
        tax,
        total,
        deposit: abono,
        balance,
        notes: datos.notes?.trim() || null,
        signature: datos.signature ?? null,
        signedBy: datos.signedBy?.trim() || null,
        createdById: createdById ?? null,
        items: { create: lineas },
        ...(abono > 0
          ? {
              payments: {
                create: {
                  amount: abono,
                  method: datos.depositMethod ?? PaymentMethod.TARJETA,
                  paidAt: cobradoEn,
                  createdById: createdById ?? null,
                },
              },
            }
          : {}),
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await sincronizarSalidasDeRecibo(tx, documento.id, createdById);
    return documento;
  });
}

/** Editar no toca los pagos: el saldo se recalcula con lo que ya entró. */
export async function actualizar(id: string, datos: DocumentoEntrada) {
  const existente = await prisma.invoice.findUnique({ where: { id } });
  if (!existente) throw HttpError.notFound('api.recibos.noEncontrado');
  if (existente.status === DocumentStatus.ANULADA) throw HttpError.unprocessable('api.recibos.anuladoNoSeEdita');
  if (datos.items.length === 0) throw HttpError.unprocessable('api.recibos.sinLineas');

  const { _sum } = await prisma.payment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } });
  const cobrado = _sum.amount ?? 0;
  if (cobrado > 0 && datos.type === DocumentType.COTIZACION) throw HttpError.unprocessable('api.recibos.conPagosNoCotizacion');

  const { lineas, subtotal, tax, total, balance } = calcularTotales(datos.items, datos.discount ?? 0, datos.taxRateBps ?? 0, cobrado);
  if (cobrado > total) throw HttpError.unprocessable('api.recibos.totalMenorQuePagado');

  return prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    const documento = await tx.invoice.update({
      where: { id },
      data: {
        type: datos.type,
        issueDate: datos.issueDate,
        patientId: datos.patientId ?? null,
        clientName: datos.clientName.trim(),
        clientEmail: datos.clientEmail?.trim().toLowerCase() || null,
        clientPhone: datos.clientPhone?.trim() || null,
        ...(datos.locale ? { locale: datos.locale } : {}),
        subtotal,
        discount: datos.discount ?? 0,
        taxRateBps: datos.taxRateBps ?? 0,
        tax,
        total,
        deposit: cobrado,
        balance,
        status: cobrado > 0 && balance === 0 ? DocumentStatus.PAGADA : DocumentStatus.EMITIDA,
        notes: datos.notes?.trim() || null,
        signature: datos.signature ?? null,
        signedBy: datos.signedBy?.trim() || null,
        items: { create: lineas },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    await sincronizarSalidasDeRecibo(tx, documento.id);
    return documento;
  });
}

export async function anular(id: string) {
  return prisma.$transaction(async (tx) => {
    const documento = await tx.invoice.update({ where: { id }, data: { status: DocumentStatus.ANULADA } });
    await sincronizarSalidasDeRecibo(tx, id);
    return documento;
  });
}

/** Deshace la anulación o devuelve el estado según lo pagado. */
export async function reabrir(id: string) {
  const documento = await prisma.invoice.findUnique({ where: { id } });
  if (!documento) throw HttpError.notFound('api.recibos.noEncontrado');
  const { _sum } = await prisma.payment.aggregate({ where: { invoiceId: id }, _sum: { amount: true } });
  const cobrado = _sum.amount ?? 0;
  const saldo = Math.max(0, documento.total - cobrado);
  return prisma.$transaction(async (tx) => {
    const reabierto = await tx.invoice.update({
      where: { id },
      data: { status: cobrado > 0 && saldo === 0 ? DocumentStatus.PAGADA : DocumentStatus.EMITIDA, deposit: cobrado, balance: saldo },
    });
    await sincronizarSalidasDeRecibo(tx, id);
    return reabierto;
  });
}

/** Cobra el saldo completo de una vez. */
export async function marcarPagada(id: string, method: PaymentMethod, usuarioId?: string) {
  const documento = await prisma.invoice.findUnique({ where: { id }, select: { id: true, type: true, status: true, total: true, deposit: true } });
  if (!documento) throw HttpError.notFound('api.recibos.noEncontrado');
  if (documento.type !== DocumentType.RECIBO) throw HttpError.unprocessable('api.recibos.cotizacionNoCobra');
  if (documento.status === DocumentStatus.ANULADA) throw HttpError.unprocessable('api.recibos.anulado');
  const pendiente = documento.total - documento.deposit;
  if (pendiente <= 0) throw HttpError.unprocessable('api.recibos.yaPagado');
  await caja.registrarPago(id, { amount: pendiente, method, paidAt: new Date() }, usuarioId);
  return prisma.invoice.findUniqueOrThrow({ where: { id } });
}

/** Una cotización aceptada se vuelve recibo (mismo número). */
export async function convertirEnRecibo(id: string) {
  const documento = await prisma.invoice.findUnique({ where: { id } });
  if (!documento) throw HttpError.notFound('api.recibos.noEncontrado');
  if (documento.type === DocumentType.RECIBO) return documento;
  return prisma.invoice.update({ where: { id }, data: { type: DocumentType.RECIBO, status: DocumentStatus.EMITIDA } });
}

/* -------------------------------------------------------------------------- */

export interface FiltroListado {
  q?: string;
  type?: DocumentType;
  status?: DocumentStatus;
  patientId?: string;
  desde?: Date;
  hasta?: Date;
  take: number;
  skip: number;
}

const literal = (texto: string) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

function porNombre(q: string): Prisma.InvoiceWhereInput {
  const palabras = q.split(/\s+/).filter(Boolean);
  const deUna = (palabra: string): Prisma.InvoiceWhereInput => ({
    OR: variantesDeAcento(palabra).map((v) => ({ clientName: { contains: literal(v), mode: 'insensitive' as const } })),
  });
  return palabras.length <= 1 ? deUna(q.trim() || q) : { AND: palabras.map(deUna) };
}

export function whereDeListado(filtro: Omit<FiltroListado, 'take' | 'skip'>): Prisma.InvoiceWhereInput {
  const digitos = filtro.q?.replace(/\D/g, '') ?? '';
  return {
    ...(filtro.type ? { type: filtro.type } : {}),
    ...(filtro.status ? { status: filtro.status } : {}),
    ...(filtro.patientId ? { patientId: filtro.patientId } : {}),
    ...(filtro.desde || filtro.hasta
      ? { issueDate: { ...(filtro.desde ? { gte: filtro.desde } : {}), ...(filtro.hasta ? { lte: filtro.hasta } : {}) } }
      : {}),
    ...(filtro.q
      ? {
          OR: [
            porNombre(filtro.q),
            { clientEmail: { contains: literal(filtro.q), mode: 'insensitive' as const } },
            ...(digitos.length >= 4 ? [{ clientPhone: { contains: digitos } }] : []),
            ...condicionPorNumero(filtro.q.replace(/^[a-z]+-/i, '')),
          ],
        }
      : {}),
  };
}

export async function listar(filtro: FiltroListado) {
  const where = whereDeListado(filtro);
  const [items, total, sumas] = await Promise.all([
    prisma.invoice.findMany({
      where,
      omit: { signature: true },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        patient: { select: { id: true, fullName: true } },
        payments: { select: { id: true, amount: true, method: true, paidAt: true }, orderBy: { paidAt: 'asc' } },
      },
      orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
      take: filtro.take,
      skip: filtro.skip,
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where: { ...where, status: { not: DocumentStatus.ANULADA } }, _sum: { total: true, balance: true } }),
  ]);
  return { items, total, take: filtro.take, skip: filtro.skip, sumaTotal: sumas._sum.total ?? 0, sumaSaldo: sumas._sum.balance ?? 0 };
}

export async function obtener(id: string) {
  const documento = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      patient: { select: { id: true, fullName: true, phone: true, email: true } },
      createdBy: { select: { id: true, fullName: true } },
      payments: { orderBy: { paidAt: 'asc' }, include: { createdBy: { select: { fullName: true } } } },
    },
  });
  if (!documento) throw HttpError.notFound('api.recibos.noEncontrado');
  return documento;
}
