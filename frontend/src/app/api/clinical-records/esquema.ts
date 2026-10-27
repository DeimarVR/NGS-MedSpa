import { z } from 'zod';
import { FaceView } from '@/generated/prisma/client';
import { claveFechaSchema } from '@/server/lib/fechaDia';
import { firmaPng } from '@/server/validaciones';

const texto = (max: number) => z.string().trim().max(max).nullish();

export const puntoSchema = z.object({
  id: z.string().trim().min(1).nullish(),
  view: z.enum(FaceView).default(FaceView.FRENTE),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zone: z.string().trim().min(1, 'v.zona').max(60),
  productId: z.string().trim().min(1).nullish(),
  productName: texto(120),
  lotId: z.string().trim().min(1).nullish(),
  lotNumber: texto(60),
  expiresAt: claveFechaSchema.nullish().or(z.literal('')),
  quantity: z.number().positive('v.cantidadPositiva').max(1000),
  unit: z.string().trim().min(1).max(10),
  technique: texto(160),
  notes: texto(400),
  appliedById: z.string().trim().min(1).nullish(),
});

export const mapaSchema = z.object({
  patientId: z.string().trim().min(1, 'v.elegirClienta'),
  procedureDate: claveFechaSchema,
  serviceId: z.string().trim().min(1).nullish(),
  appointmentId: z.string().trim().min(1).nullish(),
  patientName: z.string().trim().min(2, 'v.nombreClienta').max(160),
  patientAge: z.number().int().min(0).max(130).nullish(),
  patientPhone: texto(40),
  facePhotoUrl: z
    .string()
    .trim()
    .startsWith('/api/archivos/mapas/', 'v.imagen')
    .max(200)
    .nullish()
    .or(z.literal('')),
  notes: texto(2000),
  aftercare: texto(2000),
  nextControl: claveFechaSchema.nullish().or(z.literal('')),
  nextControlTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'v.horaInvalida')
    .nullish()
    .or(z.literal('')),
  nextControlServiceId: z.string().trim().min(1).nullish(),
  professionalSignature: firmaPng.nullish(),
  patientSignature: firmaPng.nullish(),
  entries: z.array(puntoSchema).max(150).default([]),
  version: z.string().trim().max(40).nullish(),
  claveDeEnvio: z.string().trim().min(8).max(80).nullish(),
});

export const listadoSchema = z.object({
  q: z.string().trim().min(1).optional(),
  patientId: z.string().trim().min(1).optional(),
  tipo: z.enum(['MAPA', 'PIEL']).optional(),
  take: z.coerce.number().int().min(1).max(200).default(40),
  skip: z.coerce.number().int().min(0).default(0),
});

/** Del formulario al servicio: los vacíos ('') pasan a null. */
export function aEntrada(datos: z.infer<typeof mapaSchema>) {
  return {
    ...datos,
    facePhotoUrl: datos.facePhotoUrl || null,
    nextControl: datos.nextControl || null,
    nextControlTime: datos.nextControlTime || null,
    entries: datos.entries.map((p) => ({ ...p, expiresAt: p.expiresAt || null })),
  };
}
