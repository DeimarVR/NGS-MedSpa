import { DocumentStatus } from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';

/**
 * Borrar un recibo es la excepción: solo anulado, sin pagos y sin movimientos
 * de inventario. Si era el último número, se devuelve al consecutivo.
 */
const CLAVE_CONTADOR = 'invoice_counter';

function formatear(series: string, number: number): string {
  return `${series}-${String(number).padStart(4, '0')}`;
}

export type MotivoNoBorrar = 'vigente' | 'conPagos' | 'conMovimientos' | null;

export async function queTieneElRecibo(id: string) {
  const documento = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, number: true, series: true, status: true, total: true, clientName: true, _count: { select: { payments: true, stockMoves: true } } },
  });
  if (!documento) throw HttpError.notFound('api.recibos.noEncontrado');

  const contador = await prisma.setting.findUnique({ where: { key: CLAVE_CONTADOR } });
  const pagos = documento._count.payments;
  const movimientos = documento._count.stockMoves;
  const motivo: MotivoNoBorrar =
    documento.status !== DocumentStatus.ANULADA ? 'vigente' : pagos > 0 ? 'conPagos' : movimientos > 0 ? 'conMovimientos' : null;

  return {
    id: documento.id,
    numero: formatear(documento.series, documento.number),
    clientName: documento.clientName,
    status: documento.status,
    total: documento.total,
    pagos,
    movimientos,
    sePuedeBorrar: motivo === null,
    motivo,
    liberaElNumero: Number.parseInt(contador?.value ?? '', 10) === documento.number,
  };
}

export async function borrarRecibo(id: string) {
  return prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<Array<{ id: string; number: number; series: string; status: DocumentStatus }>>`
      SELECT id, number, series, status FROM invoices WHERE id = ${id} FOR UPDATE`;
    const documento = filas[0];
    if (!documento) throw HttpError.notFound('api.recibos.noEncontrado');
    const numero = formatear(documento.series, documento.number);

    if (documento.status !== DocumentStatus.ANULADA) throw HttpError.unprocessable('api.recibos.borrarVigente', { numero });
    const [pagos, movimientos] = await Promise.all([tx.payment.count({ where: { invoiceId: id } }), tx.stockMove.count({ where: { invoiceId: id } })]);
    if (pagos > 0) throw HttpError.unprocessable('api.recibos.borrarConPagos', { numero });
    if (movimientos > 0) throw HttpError.unprocessable('api.recibos.borrarConMovimientos', { numero });

    // Solo si nadie emitió otro después; el WHERE lo garantiza.
    const devuelto = await tx.$executeRaw`
      UPDATE settings SET value = ${String(documento.number - 1)}, "updatedAt" = now()
       WHERE key = ${CLAVE_CONTADOR} AND value = ${String(documento.number)}`;

    await tx.invoice.delete({ where: { id } });
    return { numero, numeroReutilizable: devuelto > 0 };
  });
}
