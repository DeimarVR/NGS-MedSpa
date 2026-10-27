import { DocumentStatus, type DocumentType, type Prisma } from '@/generated/prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import type { Traductor } from '../../i18n';
import { clientasQueDeben } from '../invoices/porCobrar.service';
import { whereDeListado } from '../invoices/invoices.service';
import { listarInventario, type ConsultaInventario } from '../inventario/inventario.service';
import { dia, dolares, instante, numero, texto, titulos, type Celda, type Hoja } from './excel';

function numeroFormateado(series: string, number: number): string {
  return `${series}-${String(number).padStart(4, '0')}`;
}

/** Recibos y cotizaciones, más una hoja con cada pago (lo que se cuadra con el banco). */
export async function hojasDeRecibos(
  t: Traductor,
  filtro: { desde?: Date; hasta?: Date; q?: string; type?: DocumentType; status?: DocumentStatus },
): Promise<Hoja[]> {
  const where: Prisma.InvoiceWhereInput = whereDeListado(filtro);
  const documentos = await prisma.invoice.findMany({
    where,
    select: {
      number: true,
      series: true,
      type: true,
      status: true,
      issueDate: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      subtotal: true,
      discount: true,
      tax: true,
      total: true,
      deposit: true,
      balance: true,
      notes: true,
      payments: { select: { amount: true, method: true, paidAt: true, reference: true, receivedBy: true }, orderBy: { paidAt: 'asc' } },
    },
    orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
  });

  const recibos: Celda[][] = [
    titulos(t, [
      'excel.numero',
      'excel.tipo',
      'excel.fecha',
      'excel.clienta',
      'excel.correo',
      'excel.telefono',
      'excel.subtotal',
      'excel.descuento',
      'excel.impuesto',
      'excel.total',
      'excel.abonado',
      'excel.saldo',
      'excel.estado',
      'excel.notas',
    ]),
  ];
  const pagos: Array<{ cuando: number; fila: Celda[] }> = [];

  for (const d of documentos) {
    const num = numeroFormateado(d.series, d.number);
    recibos.push([
      texto(num),
      texto(t(`estados.documento.${d.type}`)),
      dia(d.issueDate),
      texto(d.clientName),
      texto(d.clientEmail),
      texto(d.clientPhone),
      dolares(d.subtotal),
      dolares(d.discount),
      dolares(d.tax),
      dolares(d.total),
      dolares(d.deposit),
      dolares(d.balance),
      texto(t(`estados.recibo.${d.status}`)),
      texto(d.notes),
    ]);
    if (d.status === DocumentStatus.ANULADA) continue;
    for (const p of d.payments) {
      pagos.push({
        cuando: p.paidAt.getTime(),
        fila: [
          instante(p.paidAt, env.CLINIC_TIMEZONE),
          texto(num),
          texto(d.clientName),
          texto(t(`estados.pago.${p.method}`)),
          dolares(p.amount),
          texto(p.reference),
          texto(p.receivedBy),
        ],
      });
    }
  }
  pagos.sort((a, b) => b.cuando - a.cuando);

  return [
    { nombre: t('excel.hojaRecibos'), anchos: [12, 12, 12, 28, 26, 15, 12, 12, 11, 12, 12, 12, 11, 36], filas: recibos },
    {
      nombre: t('excel.hojaPagos'),
      anchos: [18, 12, 28, 15, 12, 18, 22],
      filas: [
        titulos(t, ['excel.fechaPago', 'excel.documento', 'excel.clienta', 'excel.medio', 'excel.monto', 'excel.referencia', 'excel.recibio']),
        ...pagos.map((p) => p.fila),
      ],
    },
  ];
}

export async function hojaPorCobrar(t: Traductor, consulta: { q?: string } = {}): Promise<Hoja[]> {
  const { items } = await clientasQueDeben(consulta);
  const filas: Celda[][] = [
    titulos(t, ['excel.clienta', 'excel.telefono', 'excel.correo', 'excel.debeTotal', 'excel.documento', 'excel.fecha', 'excel.total', 'excel.abonado', 'excel.saldo', 'excel.dias']),
  ];
  for (const c of items) {
    c.recibos.forEach((r, i) => {
      filas.push([
        i === 0 ? texto(c.nombre) : null,
        i === 0 ? texto(c.telefono) : null,
        i === 0 ? texto(c.correo) : null,
        i === 0 ? dolares(c.debe) : null,
        texto(r.numero),
        dia(r.issueDate),
        dolares(r.total),
        dolares(r.deposit),
        dolares(r.balance),
        numero(r.dias, '0'),
      ]);
    });
  }
  return [{ nombre: t('excel.hojaPorCobrar'), anchos: [28, 15, 26, 13, 12, 12, 12, 12, 12, 7], filas }];
}

export async function hojasDeInventario(t: Traductor, consulta: ConsultaInventario = {}): Promise<Hoja[]> {
  const productos = await listarInventario({ ...consulta, incluirArchivados: true });
  const filas: Celda[][] = [
    titulos(t, [
      'excel.producto',
      'excel.marca',
      'excel.tipo',
      'excel.codigo',
      'excel.unidad',
      'excel.existencia',
      'excel.minimo',
      'excel.estado',
      'excel.precioVenta',
      'excel.proveedor',
      'excel.vence',
      'excel.notas',
    ]),
  ];
  const lotes: Celda[][] = [
    titulos(t, ['excel.producto', 'excel.lote', 'excel.vence', 'excel.recibido', 'excel.existencia', 'excel.unidad', 'excel.costo', 'excel.estado']),
  ];
  for (const p of productos) {
    const estado = !p.active
      ? 'archivado'
      : p.vencido
        ? 'vencido'
        : p.stock <= 0
          ? 'agotado'
          : p.bajo
            ? 'bajo'
            : p.porVencer
              ? 'porVencer'
              : 'ok';
    filas.push([
      texto(p.name),
      texto(p.brand),
      texto(t(`estados.producto.${p.kind}`)),
      texto(p.sku),
      texto(p.unit),
      numero(p.stock),
      numero(p.minStock),
      texto(t(`excel.estados.${estado}`)),
      dolares(p.salePrice),
      texto(p.supplier),
      dia(p.venceEl),
      texto(p.notes),
    ]);
    for (const l of p.lotes) {
      lotes.push([
        texto(p.name),
        texto(l.lotNumber),
        dia(l.expiresAt),
        dia(l.receivedAt),
        numero(l.stock),
        texto(p.unit),
        dolares(l.unitCost),
        texto(t(`excel.estados.${l.blocked ? 'bloqueado' : l.vencido ? 'vencido' : l.porVencer ? 'porVencer' : l.stock <= 0 ? 'agotado' : 'ok'}`)),
      ]);
    }
  }
  return [
    { nombre: t('excel.hojaInventario'), anchos: [30, 16, 14, 12, 10, 11, 9, 12, 12, 20, 12, 30], filas },
    { nombre: t('excel.hojaLotes'), anchos: [30, 16, 12, 12, 11, 10, 11, 12], filas: lotes },
  ];
}
