import { z } from 'zod';
import { DocumentStatus, DocumentType, PaymentMethod } from '@/generated/prisma/client';
import { claveFechaSchema, fechaDesdeClave } from '@/server/lib/fechaDia';
import { firmaPng } from '@/server/validaciones';

/** Centavos de dólar. */
const centavos = z.number().int().min(0).max(99_999_999_99);

export { fechaDesdeClave };
export const claveFecha = claveFechaSchema;

export const lineaSchema = z.object({
  quantity: z.number().int().min(1).max(9_999),
  description: z.string().trim().min(1, 'v.concepto').max(240),
  unitPrice: centavos,
  productId: z.string().trim().min(1).nullish(),
});

export const documentoSchema = z.object({
  type: z.enum(DocumentType).default(DocumentType.RECIBO),
  issueDate: claveFecha,
  patientId: z.string().trim().min(1).nullish(),
  clientName: z.string().trim().min(2, 'v.nombreClienta').max(160),
  clientEmail: z.email('v.correo').max(160).nullish().or(z.literal('')),
  clientPhone: z.string().trim().max(40).nullish(),
  locale: z.enum(['es', 'en', 'fr', 'ar', 'ja']).optional(),
  items: z.array(lineaSchema).min(1, 'v.alMenosUnaLinea').max(40),
  discount: centavos.default(0),
  /** Puntos básicos: 825 = 8,25 %. */
  taxRateBps: z.number().int().min(0).max(3000).default(0),
  deposit: centavos.default(0),
  depositMethod: z.enum(PaymentMethod).default(PaymentMethod.TARJETA),
  notes: z.string().trim().max(600).nullish(),
  signature: firmaPng.nullish(),
  signedBy: z.string().trim().max(120).nullish(),
});

export const listadoSchema = z.object({
  q: z.string().trim().min(1).optional(),
  type: z.enum(DocumentType).optional(),
  status: z.enum(DocumentStatus).optional(),
  patientId: z.string().optional(),
  desde: claveFecha.optional(),
  hasta: claveFecha.optional(),
  periodo: z.enum(['dia', 'semana', 'mes', 'todo']).default('mes'),
  fecha: claveFecha.optional(),
  take: z.coerce.number().int().min(1).max(200).default(40),
  skip: z.coerce.number().int().min(0).default(0),
});

export const estadoSchema = z.object({
  accion: z.enum(['pagar', 'anular', 'reabrir', 'convertir']),
  method: z.enum(PaymentMethod).default(PaymentMethod.TARJETA),
});
