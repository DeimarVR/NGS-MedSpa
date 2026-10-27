import { z } from 'zod';
import { Gender, PregnancyStatus, ReferralSource } from '@/generated/prisma/client';

/** Ficha de la clienta (EE. UU.): sin cédula ni EPS. */
export const patientBodySchema = z.object({
  fullName: z.string().trim().min(3, 'v.nombreCompleto').max(160),
  email: z.email('v.correo').max(160).optional().nullable().or(z.literal('')),
  phone: z.string().trim().min(7, 'v.telefonoObligatorio').max(30),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'v.fechaInvalida')
    .optional()
    .nullable()
    .or(z.literal('')),
  gender: z.enum(Gender).default(Gender.NO_DECLARA),
  address: z.string().trim().max(240).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  preferredLocale: z.enum(['es', 'en', 'fr', 'ar', 'ja']).default('en'),
  referralSource: z.enum(ReferralSource).optional().nullable(),
  referralNote: z.string().trim().max(240).optional().nullable(),
  instagram: z.string().trim().max(60).optional().nullable(),
  allergies: z.string().trim().max(2000).optional().nullable(),
  medications: z.string().trim().max(2000).optional().nullable(),
  pregnancy: z.enum(PregnancyStatus).default(PregnancyStatus.NO_DECLARA),
  medicalNotes: z.string().trim().max(5000).optional().nullable(),
  photoConsent: z.boolean().default(false),
});

export const patientUpdateSchema = patientBodySchema.partial().extend({ active: z.boolean().optional() });
