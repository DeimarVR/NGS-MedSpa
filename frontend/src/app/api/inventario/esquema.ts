import { z } from 'zod';
import { ProductKind, StockMoveReason, StockMoveType } from '@/generated/prisma/client';

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()
  .or(z.literal(''));

export const productoSchema = z.object({
  name: z.string().trim().min(2, 'v.nombreProducto').max(120),
  kind: z.enum(ProductKind).default(ProductKind.INSUMO),
  brand: z.string().trim().max(80).optional().nullable(),
  sku: z.string().trim().max(60).optional().nullable(),
  unit: z.string().trim().min(1).max(20).default('unidad'),
  packageSize: z.coerce.number().positive().max(100_000).optional().nullable(),
  packageLabel: z.string().trim().max(40).optional().nullable(),
  applicationUnit: z.string().trim().min(1).max(10).default('u'),
  applicationPerUnit: z.coerce.number().positive().max(100_000).default(1),
  presentation: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  /** Centavos. */
  salePrice: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  supplier: z.string().trim().max(120).optional().nullable(),
  minStock: z.coerce.number().min(0).max(1_000_000).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional(),
  inicial: z
    .object({
      cantidad: z.coerce.number().min(0).max(1_000_000),
      lotNumber: z.string().trim().max(60).optional().nullable(),
      expiresAt: fecha,
      unitCost: z.coerce.number().int().min(0).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const movimientoSchema = z.object({
  productId: z.string().min(1, 'v.elegirProducto'),
  type: z.enum(StockMoveType),
  reason: z.enum(StockMoveReason).default(StockMoveReason.OTRO),
  quantity: z.coerce.number().positive('v.cantidadPositiva').max(1_000_000),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'v.elegirFecha'),
  hora: z.string().regex(/^\d{2}:\d{2}$/).default('12:00'),
  patientId: z.string().optional().nullable(),
  lotNumber: z.string().trim().max(60).optional().nullable(),
  expiresAt: fecha,
  lotId: z.string().optional().nullable(),
  unitCost: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const loteSchema = z.object({
  lotNumber: z.string().trim().min(1).max(60).optional(),
  expiresAt: fecha,
  unitCost: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
  blocked: z.boolean().optional(),
});
