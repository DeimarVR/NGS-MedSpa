import { z } from 'zod';
import { PhotoType } from '@/generated/prisma/client';

/**
 * La ruta de cada foto tiene que venir de nuestra propia subida: una dirección
 * ajena puede caerse, cambiar la imagen o registrar quién la mira.
 */
const rutaDeFoto = z.string().trim().startsWith('/api/archivos/fotos/', 'v.fotoDelPanel');

const fotoSchema = z.object({
  /** Presente al editar una foto que ya existe; ausente si es nueva. */
  id: z.string().optional(),
  url: rutaDeFoto,
  type: z.enum(PhotoType).default(PhotoType.PROGRESO),
  angle: z.string().trim().min(1).max(40).default('frontal'),
  caption: z.string().trim().max(200).optional().nullable(),
  takenAt: z.iso.datetime().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const registroSchema = z.object({
  patientId: z.string().min(1, 'v.elegirClienta'),
  serviceId: z.string().optional().nullable(),
  title: z.string().trim().min(3, 'v.tituloRegistro').max(160),
  notes: z.string().trim().max(1000).optional().nullable(),
  consentSigned: z.boolean().default(false),
  /** Autorizada para redes: solo con el consentimiento de fotos FIRMADO. */
  publishable: z.boolean().default(false),
  fotos: z.array(fotoSchema).max(60).default([]),
  /** `updatedAt` con que se cargó: si otro guardó después, no se pisa. */
  version: z.string().trim().max(40).nullish(),
});

export const CON_FOTOS = {
  photos: { orderBy: [{ sortOrder: 'asc' as const }, { takenAt: 'asc' as const }] },
  patient: { select: { id: true, fullName: true, phone: true, photoConsent: true } },
  service: { select: { id: true, name: true } },
};
