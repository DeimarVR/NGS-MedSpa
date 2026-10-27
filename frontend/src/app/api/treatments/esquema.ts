import { z } from 'zod';
import { ServiceCategory } from '@/generated/prisma/client';

const DURACION_MAXIMA = 600;

const textoTraducido = z.object({
  name: z.string().trim().max(120).optional(),
  shortDesc: z.string().trim().max(240).optional(),
  description: z.string().trim().max(4000).optional(),
});

export const serviceSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'v.slug'),
  name: z.string().trim().min(3, 'v.nombreTratamiento').max(120),
  shortDesc: z.string().trim().max(240).default(''),
  description: z.string().trim().max(4000).default(''),
  category: z.enum(ServiceCategory).default(ServiceCategory.PIEL),
  durationMin: z.coerce.number().int().min(5).max(DURACION_MAXIMA).default(60),
  /** Centavos. */
  priceCents: z.coerce.number().int().min(0).optional().nullable(),
  priceMode: z.enum(['DESDE', 'POR_UNIDAD', 'FIJO']).default('DESDE'),
  touchUpDays: z.coerce.number().int().min(1).max(1095).optional().nullable(),
  icon: z.string().trim().max(40).default('sparkles'),
  benefits: z.array(z.string().trim().min(2).max(120)).max(12).default([]),
  translations: z
    .object({ en: textoTraducido, fr: textoTraducido, ar: textoTraducido, ja: textoTraducido })
    .partial()
    .default({}),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  published: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

/** Crear un tratamiento al vuelo desde una cita o un recibo: nace sin publicar. */
export const servicioRapidoSchema = z.object({
  name: z.string().trim().min(3, 'v.nombreTratamiento').max(80),
  durationMin: z.coerce.number().int().min(5).max(DURACION_MAXIMA).default(60),
  priceCents: z.coerce.number().int().min(0).nullish(),
  category: z.enum(ServiceCategory).default(ServiceCategory.PIEL),
});
