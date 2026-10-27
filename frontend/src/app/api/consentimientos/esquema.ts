import { z } from 'zod';
import { ConsentKind } from '@/generated/prisma/client';

export const plantillaSchema = z.object({
  name: z.string().trim().min(3, 'v.nombreConsentimiento').max(160),
  description: z.string().trim().max(500).optional().nullable(),
  kind: z.enum(ConsentKind).default(ConsentKind.GENERAL),
  // Solo alfabeto latino: el PDF no sabe dibujar árabe ni japonés.
  locale: z.enum(['es', 'en', 'fr']).default('en'),
  body: z.string().trim().min(120, 'v.consentimientoCorto').max(60000),
  serviceIds: z.array(z.string()).max(100).default([]),
  active: z.boolean().optional(),
});

export const firmaSchema = z.object({
  templateId: z.string().min(1, 'v.elegirConsentimiento'),
  patientId: z.string().min(1, 'v.elegirClienta'),
  signature: z.string().min(50, 'v.faltaFirma').max(600_000, 'v.firmaPesada'),
  templateVersion: z.number().int().min(1).optional(),
  professionalName: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
