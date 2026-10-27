import {
  DocumentStatus,
  DocumentType,
  StockMoveReason,
  StockMoveType,
  type Prisma,
} from '@/generated/prisma/client';
import { redondear } from './inventario.service';

/**
 * Las salidas de inventario de un recibo: lo vendido en el mostrador.
 *
 * Se descuenta cuando el recibo YA tiene algo cobrado y no está anulado; si
 * se anula o se borra el cobro, las salidas se quitan. Se calcula entero cada
 * vez («cómo debería quedar») para que cobrar dos veces no descuente el doble.
 *
 * Con lotes, sale primero lo que vence antes (FEFO).
 */
export async function sincronizarSalidasDeRecibo(tx: Prisma.TransactionClient, invoiceId: string, usuarioId?: string): Promise<void> {
  const recibo = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      series: true,
      type: true,
      status: true,
      deposit: true,
      issueDate: true,
      patientId: true,
      items: { select: { productId: true, quantity: true } },
    },
  });
  if (!recibo) return;

  const debeDescontar = recibo.type === DocumentType.RECIBO && recibo.status !== DocumentStatus.ANULADA && recibo.deposit > 0;

  const objetivo = new Map<string, number>();
  if (debeDescontar) {
    for (const linea of recibo.items) {
      if (!linea.productId || linea.quantity <= 0) continue;
      objetivo.set(linea.productId, (objetivo.get(linea.productId) ?? 0) + linea.quantity);
    }
  }

  const salidas = await tx.stockMove.findMany({ where: { invoiceId, reason: StockMoveReason.VENTA }, select: { productId: true, quantity: true } });
  const actual = new Map<string, number>();
  for (const s of salidas) actual.set(s.productId, redondear((actual.get(s.productId) ?? 0) + s.quantity));

  const yaCuadra = objetivo.size === actual.size && [...objetivo].every(([p, c]) => Math.abs((actual.get(p) ?? 0) - c) < 1e-6);
  if (yaCuadra) return;

  // Las salidas de VENTA son del sistema: se rehacen enteras (no son historia
  // que alguien haya escrito a mano).
  await tx.stockMove.deleteMany({ where: { invoiceId, reason: StockMoveReason.VENTA } });
  if (objetivo.size === 0) return;

  const documento = `${recibo.series}-${String(recibo.number).padStart(4, '0')}`;

  for (const [productId, cantidad] of objetivo) {
    // Existencia por lote, para repartir FEFO.
    const lotes = await tx.lot.findMany({ where: { productId, blocked: false }, orderBy: [{ expiresAt: 'asc' }, { receivedAt: 'asc' }] });
    let falta = cantidad;
    for (const lote of lotes) {
      if (falta <= 0) break;
      const filas = await tx.stockMove.groupBy({ by: ['type'], where: { lotId: lote.id }, _sum: { quantity: true } });
      const hay = filas.reduce((t, f) => t + (f._sum.quantity ?? 0) * (f.type === StockMoveType.SALIDA ? -1 : 1), 0);
      if (hay <= 0) continue;
      const toma = Math.min(hay, falta);
      await tx.stockMove.create({
        data: {
          productId,
          lotId: lote.id,
          invoiceId: recibo.id,
          type: StockMoveType.SALIDA,
          reason: StockMoveReason.VENTA,
          quantity: redondear(toma),
          occurredAt: recibo.issueDate,
          patientId: recibo.patientId,
          notes: documento,
          createdById: usuarioId ?? null,
        },
      });
      falta = redondear(falta - toma);
    }
    if (falta > 0) {
      // Sin lote con existencia: la venta igual se descuenta (queda en negativo
      // y el aviso de inventario lo señala).
      await tx.stockMove.create({
        data: {
          productId,
          invoiceId: recibo.id,
          type: StockMoveType.SALIDA,
          reason: StockMoveReason.VENTA,
          quantity: redondear(falta),
          occurredAt: recibo.issueDate,
          patientId: recibo.patientId,
          notes: documento,
          createdById: usuarioId ?? null,
        },
      });
    }
  }
}
