import { z } from 'zod';
import { SkinType } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import { parseZonedDateTime } from '@/server/lib/datetime';
import { claveFechaSchema } from '@/server/lib/fechaDia';
import { firmaPng } from '@/server/validaciones';

const fecha = claveFechaSchema;

const sesionSchema = z.object({
  id: z.string().optional(),
  sessionDate: fecha,
  sessionLabel: z.string().trim().max(40).optional().nullable(),
  serviceId: z.string().optional().nullable(),
  zones: z.array(z.string().max(40)).max(20).default([]),
  productId: z.string().optional().nullable(),
  productName: z.string().trim().max(120).optional().nullable(),
  lotId: z.string().optional().nullable(),
  lotNumber: z.string().trim().max(60).optional().nullable(),
  quantity: z.coerce.number().min(0).max(1000).optional().nullable(),
  quantityUnit: z.string().trim().max(12).optional().nullable(),
  technique: z.string().trim().max(300).optional().nullable(),
  findings: z.string().trim().max(1000).optional().nullable(),
  homeCare: z.string().trim().max(1000).optional().nullable(),
  nextControl: fecha.optional().nullable().or(z.literal('')),
  nextControlTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'v.horaInvalida')
    .optional()
    .nullable()
    .or(z.literal('')),
  nextControlServiceId: z.string().optional().nullable(),
  professionalSignature: firmaPng.optional().nullable(),
  patientSignature: firmaPng.optional().nullable(),
});

export const fichaPielSchema = z.object({
  patientId: z.string().min(1, 'v.elegirClienta'),
  openedAt: fecha,
  patientName: z.string().trim().min(2, 'v.nombreClienta').max(160),
  patientAge: z.coerce.number().int().min(0).max(120).optional().nullable(),
  patientPhone: z.string().trim().max(30).optional().nullable(),
  skinType: z.enum(SkinType).optional().nullable().or(z.literal('')),
  skinCondition: z.string().trim().max(120).optional().nullable(),
  concerns: z.array(z.string().trim().max(80)).max(20).default([]),
  allergies: z.string().trim().max(500).optional().nullable(),
  contraindications: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  entries: z.array(sesionSchema).max(60).default([]),
  version: z.string().trim().max(40).nullish(),
  claveDeEnvio: z.string().trim().min(8).max(80).nullish(),
});

/** Las fechas sin hora se guardan a mediodía en la clínica (no se corren de día). */
export function aEntrada(datos: z.infer<typeof fichaPielSchema>) {
  const zona = env.CLINIC_TIMEZONE;
  return {
    ...datos,
    skinType: datos.skinType || null,
    openedAt: parseZonedDateTime(datos.openedAt, '12:00', zona),
    entries: datos.entries.map((s) => ({
      ...s,
      sessionDate: parseZonedDateTime(s.sessionDate, '12:00', zona),
      nextControl: s.nextControl ? new Date(`${s.nextControl}T00:00:00.000Z`) : null,
      nextControlTime: s.nextControlTime || null,
    })),
  };
}
