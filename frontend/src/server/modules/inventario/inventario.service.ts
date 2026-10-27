import {
  Prisma,
  ProductKind,
  StockMoveReason,
  StockMoveType,
  type PrismaClient,
} from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';

/**
 * Inventario POR LOTE.
 *
 * La existencia NO se guarda: se calcula sumando movimientos, por producto y
 * por lote. Un contador guardado se desincroniza el día que alguien escribe un
 * movimiento sin pasar por aquí, y a partir de ahí el inventario miente.
 *
 * Toxinas, rellenos, bioestimuladores y boosters se rigen por lote y
 * vencimiento: cada entrada crea (o suma a) un lote, y cada aplicación del
 * mapa facial descuenta de un lote concreto y lo deja anotado. Así, si retiran
 * un lote del mercado, se sabe a quién se le aplicó.
 *
 * Los movimientos no se borran nunca: lo mal anotado se corrige con otro
 * movimiento en sentido contrario.
 */

type Cliente = PrismaClient | Prisma.TransactionClient;

/** Los que exigen lote y vencimiento al entrar. */
export const CON_LOTE: ProductKind[] = [
  ProductKind.TOXINA,
  ProductKind.RELLENO,
  ProductKind.BIOESTIMULADOR,
  ProductKind.SKIN_BOOSTER,
];

export function exigeLote(kind: ProductKind): boolean {
  return CON_LOTE.includes(kind);
}

/** Una salida resta; entradas y ajustes suman. */
function signo(tipo: StockMoveType): 1 | -1 {
  return tipo === StockMoveType.SALIDA ? -1 : 1;
}

/** Tres decimales bastan (0,055 jeringas = 0,055 mL). Evita arrastrar 0,30000000004. */
export function redondear(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Días antes del vencimiento en que un lote empieza a avisar. */
export const DIAS_POR_VENCER = 60;

/* ------------------------------------------------------------------------ *
 * Catálogo
 * ------------------------------------------------------------------------ */

export interface ProductoEntrada {
  name: string;
  kind: ProductKind;
  brand?: string | null;
  sku?: string | null;
  unit: string;
  packageSize?: number | null;
  packageLabel?: string | null;
  applicationUnit: string;
  applicationPerUnit: number;
  presentation?: string | null;
  category?: string | null;
  salePrice?: number | null;
  supplier?: string | null;
  minStock?: number;
  notes?: string | null;
  active?: boolean;
  /** Existencia inicial, con su lote si el producto lo exige. */
  inicial?: { cantidad: number; lotNumber?: string | null; expiresAt?: Date | null; unitCost?: number | null } | null;
}

function datosDeProducto(datos: ProductoEntrada) {
  return {
    name: datos.name.trim(),
    kind: datos.kind,
    brand: datos.brand?.trim() || null,
    sku: datos.sku?.trim() || null,
    unit: datos.unit.trim(),
    packageSize: datos.packageSize ?? null,
    packageLabel: datos.packageLabel?.trim() || null,
    applicationUnit: datos.applicationUnit.trim(),
    applicationPerUnit: datos.applicationPerUnit > 0 ? datos.applicationPerUnit : 1,
    presentation: datos.presentation?.trim() || null,
    category: datos.category?.trim() || null,
    salePrice: datos.salePrice ?? null,
    supplier: datos.supplier?.trim() || null,
    minStock: datos.minStock ?? 0,
    notes: datos.notes?.trim() || null,
  };
}

export async function crearProducto(datos: ProductoEntrada, usuarioId?: string) {
  const inicial = datos.inicial && datos.inicial.cantidad > 0 ? datos.inicial : null;
  if (inicial && exigeLote(datos.kind) && !inicial.lotNumber?.trim()) {
    throw HttpError.unprocessable('api.inventario.faltaLote');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const producto = await tx.product.create({ data: datosDeProducto(datos) });
      if (inicial) {
        const lote = inicial.lotNumber?.trim()
          ? await tx.lot.create({
              data: {
                productId: producto.id,
                lotNumber: inicial.lotNumber.trim(),
                expiresAt: inicial.expiresAt ?? null,
                unitCost: inicial.unitCost ?? null,
              },
            })
          : null;
        await tx.stockMove.create({
          data: {
            productId: producto.id,
            lotId: lote?.id ?? null,
            type: StockMoveType.ENTRADA,
            reason: StockMoveReason.CONTEO,
            quantity: redondear(inicial.cantidad),
            occurredAt: new Date(),
            unitCost: inicial.unitCost ?? null,
            notes: 'Existencia inicial',
            createdById: usuarioId ?? null,
          },
        });
      }
      return producto;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw HttpError.conflict('api.inventario.codigoRepetido');
    }
    throw error;
  }
}

export async function actualizarProducto(id: string, datos: ProductoEntrada) {
  const existe = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw HttpError.notFound('api.inventario.productoNoEncontrado');
  return prisma.product.update({
    where: { id },
    data: { ...datosDeProducto(datos), ...(datos.active === undefined ? {} : { active: datos.active }) },
  });
}

/**
 * Sin movimientos se borra (se creó por error). Con movimientos se archiva, y
 * lo que quedaba se saca con un conteo para que no siga sumando.
 */
export async function archivarProducto(id: string, usuarioId?: string) {
  const producto = await prisma.product.findUnique({ where: { id }, select: { id: true, active: true } });
  if (!producto) throw HttpError.notFound('api.inventario.productoNoEncontrado');

  const movimientos = await prisma.stockMove.count({ where: { productId: id } });
  if (movimientos === 0) {
    await prisma.product.delete({ where: { id } });
    return { borrado: true };
  }

  const lotes = await existenciasPorLote(prisma, id);
  return prisma.$transaction(async (tx) => {
    if (producto.active) {
      for (const [lotId, cantidad] of lotes) {
        if (cantidad <= 0) continue;
        await tx.stockMove.create({
          data: {
            productId: id,
            lotId: lotId === SIN_LOTE ? null : lotId,
            type: StockMoveType.SALIDA,
            reason: StockMoveReason.CONTEO,
            quantity: redondear(cantidad),
            occurredAt: new Date(),
            notes: 'Producto archivado: existencia a cero',
            createdById: usuarioId ?? null,
          },
        });
      }
    }
    await tx.product.update({ where: { id }, data: { active: false } });
    return { borrado: false };
  });
}

/* ------------------------------------------------------------------------ *
 * Existencias
 * ------------------------------------------------------------------------ */

const SIN_LOTE = '__sin_lote__';

/** Existencia de cada lote de un producto (los movimientos sin lote, aparte). */
async function existenciasPorLote(cliente: Cliente, productId: string): Promise<Map<string, number>> {
  const filas = await cliente.stockMove.groupBy({ by: ['lotId', 'type'], where: { productId }, _sum: { quantity: true } });
  const mapa = new Map<string, number>();
  for (const f of filas) {
    const clave = f.lotId ?? SIN_LOTE;
    mapa.set(clave, redondear((mapa.get(clave) ?? 0) + (f._sum.quantity ?? 0) * signo(f.type)));
  }
  return mapa;
}

export async function stockDe(productId: string, cliente: Cliente = prisma): Promise<number> {
  const filas = await cliente.stockMove.groupBy({ by: ['type'], where: { productId }, _sum: { quantity: true } });
  return redondear(filas.reduce((t, f) => t + (f._sum.quantity ?? 0) * signo(f.type), 0));
}

export async function stockDeLote(lotId: string, cliente: Cliente = prisma): Promise<number> {
  const filas = await cliente.stockMove.groupBy({ by: ['type'], where: { lotId }, _sum: { quantity: true } });
  return redondear(filas.reduce((t, f) => t + (f._sum.quantity ?? 0) * signo(f.type), 0));
}

export interface LoteConStock {
  id: string;
  lotNumber: string;
  expiresAt: Date | null;
  receivedAt: Date;
  unitCost: number | null;
  blocked: boolean;
  notes: string | null;
  stock: number;
  vencido: boolean;
  porVencer: boolean;
}

export interface ProductoConStock {
  id: string;
  name: string;
  kind: ProductKind;
  brand: string | null;
  sku: string | null;
  unit: string;
  packageSize: number | null;
  packageLabel: string | null;
  applicationUnit: string;
  applicationPerUnit: number;
  presentation: string | null;
  category: string | null;
  salePrice: number | null;
  supplier: string | null;
  minStock: number;
  notes: string | null;
  active: boolean;
  stock: number;
  bajo: boolean;
  movimientos: number;
  venceEl: Date | null;
  vencido: boolean;
  porVencer: boolean;
  lotes: LoteConStock[];
}

export interface ConsultaInventario {
  q?: string;
  kind?: ProductKind;
  soloBajos?: boolean;
  incluirArchivados?: boolean;
  soloArchivados?: boolean;
  soloPorVencer?: boolean;
  orden?: 'nombre' | 'vencimiento';
}

export async function listarInventario(consulta: ConsultaInventario = {}): Promise<ProductoConStock[]> {
  const productos = await prisma.product.findMany({
    where: {
      ...(consulta.soloArchivados ? { active: false } : consulta.incluirArchivados ? {} : { active: true }),
      ...(consulta.kind ? { kind: consulta.kind } : {}),
      ...(consulta.q
        ? {
            OR: [
              { name: { contains: consulta.q, mode: 'insensitive' as const } },
              { brand: { contains: consulta.q, mode: 'insensitive' as const } },
              { sku: { contains: consulta.q, mode: 'insensitive' as const } },
              { category: { contains: consulta.q, mode: 'insensitive' as const } },
              { supplier: { contains: consulta.q, mode: 'insensitive' as const } },
              { lots: { some: { lotNumber: { contains: consulta.q, mode: 'insensitive' as const } } } },
            ],
          }
        : {}),
    },
    include: { lots: { orderBy: [{ expiresAt: 'asc' }, { receivedAt: 'asc' }] } },
    orderBy: { name: 'asc' },
  });
  if (productos.length === 0) return [];

  const ids = productos.map((p) => p.id);
  const [porTipo, porLote] = await Promise.all([
    prisma.stockMove.groupBy({ by: ['productId', 'type'], where: { productId: { in: ids } }, _sum: { quantity: true }, _count: { _all: true } }),
    prisma.stockMove.groupBy({ by: ['lotId', 'type'], where: { productId: { in: ids }, lotId: { not: null } }, _sum: { quantity: true } }),
  ]);

  const stock = new Map<string, number>();
  const movimientos = new Map<string, number>();
  for (const f of porTipo) {
    stock.set(f.productId, redondear((stock.get(f.productId) ?? 0) + (f._sum.quantity ?? 0) * signo(f.type)));
    movimientos.set(f.productId, (movimientos.get(f.productId) ?? 0) + f._count._all);
  }
  const stockLote = new Map<string, number>();
  for (const f of porLote) {
    if (!f.lotId) continue;
    stockLote.set(f.lotId, redondear((stockLote.get(f.lotId) ?? 0) + (f._sum.quantity ?? 0) * signo(f.type)));
  }

  const hoy = new Date();
  const limite = new Date(hoy.getTime() + DIAS_POR_VENCER * 86_400_000);

  const conStock: ProductoConStock[] = productos.map(({ lots, ...producto }) => {
    const lotes: LoteConStock[] = lots.map((l) => {
      const cantidad = stockLote.get(l.id) ?? 0;
      return {
        id: l.id,
        lotNumber: l.lotNumber,
        expiresAt: l.expiresAt,
        receivedAt: l.receivedAt,
        unitCost: l.unitCost,
        blocked: l.blocked,
        notes: l.notes,
        stock: cantidad,
        vencido: cantidad > 0 && l.expiresAt !== null && l.expiresAt < hoy,
        porVencer: cantidad > 0 && l.expiresAt !== null && l.expiresAt >= hoy && l.expiresAt <= limite,
      };
    });
    // El vencimiento que importa es el del primer lote que todavía tiene algo.
    const conExistencia = lotes.filter((l) => l.stock > 0 && l.expiresAt);
    const venceEl = conExistencia.length ? conExistencia[0].expiresAt : null;
    const cantidad = stock.get(producto.id) ?? 0;
    return {
      ...producto,
      stock: cantidad,
      bajo: producto.minStock > 0 && cantidad < producto.minStock,
      movimientos: movimientos.get(producto.id) ?? 0,
      venceEl,
      vencido: lotes.some((l) => l.vencido),
      porVencer: lotes.some((l) => l.porVencer),
      lotes,
    };
  });

  const filtrados = conStock
    .filter((p) => (consulta.soloBajos ? p.bajo : true))
    .filter((p) => (consulta.soloPorVencer ? p.vencido || p.porVencer : true));

  if (consulta.orden !== 'vencimiento') return filtrados;
  return [...filtrados].sort((a, b) => {
    if (a.venceEl && b.venceEl) return a.venceEl.getTime() - b.venceEl.getTime();
    if (a.venceEl) return -1;
    if (b.venceEl) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Lotes con existencia de un producto, para elegir al aplicar. Primero el que
 * vence antes (FEFO). Los bloqueados (retirados) no se ofrecen.
 */
export async function lotesDisponibles(productId: string) {
  const lotes = await prisma.lot.findMany({
    where: { productId, blocked: false },
    orderBy: [{ expiresAt: 'asc' }, { receivedAt: 'asc' }],
  });
  const conStock = await Promise.all(lotes.map(async (l) => ({ ...l, stock: await stockDeLote(l.id) })));
  return conStock.filter((l) => l.stock > 0);
}

/* ------------------------------------------------------------------------ *
 * Movimientos
 * ------------------------------------------------------------------------ */

export interface MovimientoEntrada {
  productId: string;
  type: StockMoveType;
  reason: StockMoveReason;
  quantity: number;
  occurredAt: Date;
  patientId?: string | null;
  /** Para entradas: el número de lote (se crea si no existe). */
  lotNumber?: string | null;
  expiresAt?: Date | null;
  /** Para salidas y ajustes: el lote del que sale. */
  lotId?: string | null;
  unitCost?: number | null;
  notes?: string | null;
}

export async function registrarMovimiento(datos: MovimientoEntrada, usuarioId?: string) {
  if (!(datos.quantity > 0)) throw HttpError.unprocessable('api.inventario.cantidadPositiva');
  if (datos.reason === StockMoveReason.VENTA || datos.reason === StockMoveReason.CORRECCION) {
    throw HttpError.unprocessable('api.inventario.motivoDelSistema');
  }

  const producto = await prisma.product.findUnique({
    where: { id: datos.productId },
    select: { id: true, name: true, unit: true, active: true, kind: true },
  });
  if (!producto) throw HttpError.notFound('api.inventario.productoNoEncontrado');

  if (!producto.active && datos.type === StockMoveType.ENTRADA) throw HttpError.unprocessable('api.inventario.archivado');

  const paciente = datos.reason === StockMoveReason.USO_EN_PACIENTE ? (datos.patientId ?? null) : null;
  if (datos.reason === StockMoveReason.USO_EN_PACIENTE && !paciente) throw HttpError.unprocessable('api.inventario.eligeClienta');

  return prisma.$transaction(async (tx) => {
    let lotId: string | null = null;

    if (datos.type === StockMoveType.ENTRADA) {
      const numero = datos.lotNumber?.trim();
      if (exigeLote(producto.kind) && !numero) throw HttpError.unprocessable('api.inventario.faltaLote');
      if (numero) {
        const lote = await tx.lot.upsert({
          where: { productId_lotNumber: { productId: producto.id, lotNumber: numero } },
          create: {
            productId: producto.id,
            lotNumber: numero,
            expiresAt: datos.expiresAt ?? null,
            receivedAt: datos.occurredAt,
            unitCost: datos.unitCost ?? null,
          },
          // Un lote que ya existía conserva su vencimiento salvo que llegue uno.
          update: { ...(datos.expiresAt ? { expiresAt: datos.expiresAt } : {}) },
        });
        lotId = lote.id;
      }
    } else {
      lotId = datos.lotId ?? null;
      if (exigeLote(producto.kind) && !lotId) throw HttpError.unprocessable('api.inventario.eligeLote');
      if (lotId) {
        const lote = await tx.lot.findFirst({ where: { id: lotId, productId: producto.id } });
        if (!lote) throw HttpError.notFound('api.inventario.loteNoEncontrado');
      }
      if (datos.type === StockMoveType.SALIDA) {
        const disponible = lotId ? await stockDeLote(lotId, tx) : await stockDe(producto.id, tx);
        if (datos.quantity > disponible + 1e-9) {
          throw HttpError.unprocessable('api.inventario.noAlcanza', { hay: disponible, unidad: producto.unit, producto: producto.name });
        }
      }
    }

    return tx.stockMove.create({
      data: {
        productId: producto.id,
        lotId,
        type: datos.type,
        reason: datos.reason,
        quantity: redondear(datos.quantity),
        occurredAt: datos.occurredAt,
        patientId: paciente,
        unitCost: datos.type === StockMoveType.ENTRADA ? (datos.unitCost ?? null) : null,
        notes: datos.notes?.trim() || null,
        createdById: usuarioId ?? null,
      },
      include: {
        product: { select: { id: true, name: true, unit: true } },
        lot: { select: { id: true, lotNumber: true } },
        patient: { select: { id: true, fullName: true } },
        createdBy: { select: { fullName: true } },
      },
    });
  });
}

export interface ConsultaMovimientos {
  productId?: string;
  lotId?: string;
  patientId?: string;
  type?: StockMoveType;
  desde?: Date;
  hasta?: Date;
  take?: number;
}

export async function listarMovimientos(consulta: ConsultaMovimientos = {}) {
  const filas = await prisma.stockMove.findMany({
    where: {
      ...(consulta.productId ? { productId: consulta.productId } : {}),
      ...(consulta.lotId ? { lotId: consulta.lotId } : {}),
      ...(consulta.patientId ? { patientId: consulta.patientId } : {}),
      ...(consulta.type ? { type: consulta.type } : {}),
      ...(consulta.desde || consulta.hasta
        ? { occurredAt: { ...(consulta.desde ? { gte: consulta.desde } : {}), ...(consulta.hasta ? { lt: consulta.hasta } : {}) } }
        : {}),
    },
    include: {
      product: { select: { id: true, name: true, unit: true, kind: true } },
      lot: { select: { id: true, lotNumber: true, expiresAt: true } },
      patient: { select: { id: true, fullName: true } },
      createdBy: { select: { fullName: true } },
      correction: { select: { id: true } },
    },
    orderBy: { occurredAt: 'desc' },
    take: consulta.take ?? 100,
  });
  return filas.map(({ correction, ...fila }) => ({ ...fila, corregido: correction !== null }));
}

/** Deshace un movimiento mal anotado con otro en sentido contrario. */
export async function corregirMovimiento(id: string, motivo?: string, usuarioId?: string) {
  const original = await prisma.stockMove.findUnique({ where: { id } });
  if (!original) throw HttpError.notFound('api.inventario.movimientoNoEncontrado');
  if (original.reason === StockMoveReason.VENTA) throw HttpError.unprocessable('api.inventario.esDeRecibo');
  if (original.clinicalEntryId || original.facialEntryId) throw HttpError.unprocessable('api.inventario.esDeAplicacion');
  if (original.reason === StockMoveReason.CORRECCION) throw HttpError.unprocessable('api.inventario.yaEsCorreccion');
  if (await prisma.stockMove.count({ where: { correctsId: id } })) throw HttpError.unprocessable('api.inventario.yaCorregido');

  return prisma.stockMove.create({
    data: {
      productId: original.productId,
      lotId: original.lotId,
      type: original.type === StockMoveType.SALIDA ? StockMoveType.ENTRADA : StockMoveType.SALIDA,
      reason: StockMoveReason.CORRECCION,
      quantity: original.quantity,
      occurredAt: new Date(),
      correctsId: original.id,
      notes: motivo?.trim() || null,
      createdById: usuarioId ?? null,
    },
  });
}

/* ------------------------------------------------------------------------ *
 * Aplicaciones en la clienta (mapa facial y ficha de piel)
 * ------------------------------------------------------------------------ */

export interface UsoEnClienta {
  productId: string | null;
  lotId: string | null;
  /** Cantidad APLICADA, en la unidad de aplicación («u» o «mL»). */
  cantidadAplicada: number;
  patientId: string;
  occurredAt: Date;
  clinicalEntryId?: string;
  facialEntryId?: string;
  usuarioId?: string;
}

/**
 * Deja la salida de inventario de UNA aplicación igual a lo que dice la
 * aplicación. Si ya tenía salida y cambió (cantidad o lote), la vieja se
 * deshace con una corrección y se crea la nueva: el historial queda entero.
 *
 * Se permite quedar en negativo: la aplicación ya ocurrió y tiene que quedar
 * en la historia clínica aunque el inventario no esté al día. El aviso de
 * «producto en negativo» se encarga de que alguien lo revise.
 */
export async function sincronizarUso(tx: Prisma.TransactionClient, uso: UsoEnClienta | null, enlace: { clinicalEntryId?: string; facialEntryId?: string }) {
  const where = enlace.clinicalEntryId ? { clinicalEntryId: enlace.clinicalEntryId } : { facialEntryId: enlace.facialEntryId };
  const previa = await tx.stockMove.findFirst({ where });

  let cantidad = 0;
  if (uso?.productId && uso.cantidadAplicada > 0) {
    const producto = await tx.product.findUnique({ where: { id: uso.productId }, select: { applicationPerUnit: true } });
    if (producto) cantidad = redondear(uso.cantidadAplicada / (producto.applicationPerUnit || 1));
  }

  const igual =
    previa &&
    uso?.productId &&
    previa.productId === uso.productId &&
    (previa.lotId ?? null) === (uso.lotId ?? null) &&
    Math.abs(previa.quantity - cantidad) < 1e-6 &&
    previa.patientId === uso.patientId;
  if (igual) return;

  if (previa) {
    // Se suelta de la aplicación y se deshace con una corrección.
    await tx.stockMove.update({ where: { id: previa.id }, data: enlace.clinicalEntryId ? { clinicalEntryId: null } : { facialEntryId: null } });
    await tx.stockMove.create({
      data: {
        productId: previa.productId,
        lotId: previa.lotId,
        type: StockMoveType.ENTRADA,
        reason: StockMoveReason.CORRECCION,
        quantity: previa.quantity,
        occurredAt: new Date(),
        correctsId: previa.id,
        patientId: previa.patientId,
        notes: 'Aplicación corregida o borrada',
        createdById: uso?.usuarioId ?? null,
      },
    });
  }

  if (!uso?.productId || cantidad <= 0) return;

  await tx.stockMove.create({
    data: {
      productId: uso.productId,
      lotId: uso.lotId,
      type: StockMoveType.SALIDA,
      reason: StockMoveReason.USO_EN_PACIENTE,
      quantity: cantidad,
      occurredAt: uso.occurredAt,
      patientId: uso.patientId,
      ...enlace,
      createdById: uso.usuarioId ?? null,
    },
  });
}

/* ------------------------------------------------------------------------ *
 * Avisos y trazabilidad
 * ------------------------------------------------------------------------ */

/** Lotes con existencia que vencen pronto o ya vencieron. */
export async function lotesPorVencer(dias = DIAS_POR_VENCER) {
  const limite = new Date(Date.now() + dias * 86_400_000);
  const lotes = await prisma.lot.findMany({
    where: { expiresAt: { not: null, lte: limite }, product: { active: true } },
    include: { product: { select: { id: true, name: true, unit: true } } },
    orderBy: { expiresAt: 'asc' },
    take: 100,
  });
  const conStock = await Promise.all(lotes.map(async (l) => ({ ...l, stock: await stockDeLote(l.id) })));
  return conStock.filter((l) => l.stock > 0);
}

/**
 * A quién se le aplicó un lote: la respuesta a «retiraron el lote X».
 * Junta el mapa facial, la ficha de piel y las salidas sueltas por clienta.
 */
export async function trazarLote(lotId: string) {
  const lote = await prisma.lot.findUnique({ where: { id: lotId }, include: { product: { select: { name: true, unit: true } } } });
  if (!lote) throw HttpError.notFound('api.inventario.loteNoEncontrado');

  const [puntos, sesiones, salidas] = await Promise.all([
    prisma.clinicalEntry.findMany({
      where: { lotId },
      select: {
        quantity: true,
        unit: true,
        zone: true,
        record: { select: { id: true, procedureDate: true, patient: { select: { id: true, fullName: true, phone: true } } } },
      },
    }),
    prisma.facialEntry.findMany({
      where: { lotId },
      select: {
        quantity: true,
        quantityUnit: true,
        sessionDate: true,
        record: { select: { id: true, patient: { select: { id: true, fullName: true, phone: true } } } },
      },
    }),
    prisma.stockMove.findMany({
      where: { lotId, type: StockMoveType.SALIDA, patientId: { not: null }, clinicalEntryId: null, facialEntryId: null },
      select: { quantity: true, occurredAt: true, patient: { select: { id: true, fullName: true, phone: true } } },
    }),
  ]);

  type Fila = { patientId: string; nombre: string; telefono: string; fecha: Date; cantidad: number; unidad: string; enlace: string | null };
  const filas: Fila[] = [
    ...puntos.map((p) => ({
      patientId: p.record.patient.id,
      nombre: p.record.patient.fullName,
      telefono: p.record.patient.phone,
      fecha: p.record.procedureDate,
      cantidad: p.quantity,
      unidad: p.unit,
      enlace: `/admin/mapa-facial/${p.record.id}`,
    })),
    ...sesiones.map((s) => ({
      patientId: s.record.patient.id,
      nombre: s.record.patient.fullName,
      telefono: s.record.patient.phone,
      fecha: s.sessionDate,
      cantidad: s.quantity ?? 0,
      unidad: s.quantityUnit ?? '',
      enlace: `/admin/mapa-facial/piel/${s.record.id}`,
    })),
    ...salidas
      .filter((s) => s.patient)
      .map((s) => ({
        patientId: s.patient!.id,
        nombre: s.patient!.fullName,
        telefono: s.patient!.phone,
        fecha: s.occurredAt,
        cantidad: s.quantity,
        unidad: lote.product.unit,
        enlace: null,
      })),
  ];
  filas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return { lote: { ...lote, stock: await stockDeLote(lote.id) }, aplicaciones: filas };
}

export async function bloquearLote(lotId: string, blocked: boolean, notes?: string | null) {
  return prisma.lot.update({ where: { id: lotId }, data: { blocked, ...(notes !== undefined ? { notes } : {}) } });
}

export async function actualizarLote(lotId: string, datos: { lotNumber?: string; expiresAt?: Date | null; unitCost?: number | null; notes?: string | null }) {
  return prisma.lot.update({
    where: { id: lotId },
    data: {
      ...(datos.lotNumber ? { lotNumber: datos.lotNumber.trim() } : {}),
      ...(datos.expiresAt !== undefined ? { expiresAt: datos.expiresAt } : {}),
      ...(datos.unitCost !== undefined ? { unitCost: datos.unitCost } : {}),
      ...(datos.notes !== undefined ? { notes: datos.notes } : {}),
    },
  });
}

export function productosSinPrecio() {
  return prisma.product.findMany({
    where: { active: true, salePrice: null, kind: ProductKind.VENTA },
    select: { id: true, name: true, unit: true },
    orderBy: { name: 'asc' },
  });
}
