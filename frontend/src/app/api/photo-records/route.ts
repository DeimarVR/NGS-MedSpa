import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { variantesDeAcento } from '@/server/lib/acentos';
import { body, query, requireAuth, route } from '@/server/http';
import { CON_FOTOS, registroSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Registro fotográfico de las clientas. TODO es interno: no hay ruta pública.
 * Marcar una foto como «se puede publicar» exige el consentimiento de fotos
 * firmado, y ni así se publica sola.
 */
const listQuerySchema = z.object({
  patientId: z.string().optional(),
  q: z.string().trim().min(1).max(80).optional(),
  publicables: z.enum(['true', 'false']).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listQuerySchema);
  const variantes = q.q ? variantesDeAcento(q.q) : [];
  return {
    items: await prisma.photoRecord.findMany({
      where: {
        ...(q.patientId ? { patientId: q.patientId } : {}),
        ...(q.publicables === 'true' ? { publishable: true } : {}),
        ...(q.q
          ? {
              OR: [
                ...variantes.map((v) => ({ title: { contains: v, mode: 'insensitive' as const } })),
                ...variantes.map((v) => ({ patient: { fullName: { contains: v, mode: 'insensitive' as const } } })),
              ],
            }
          : {}),
      },
      include: CON_FOTOS,
      orderBy: { createdAt: 'desc' },
      take: q.take,
    }),
  };
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, registroSchema);

  const clienta = await prisma.patient.findUnique({ where: { id: datos.patientId }, select: { photoConsent: true } });
  if (!clienta) throw HttpError.notFound('api.clientas.noEncontrada');
  if (datos.publishable && !clienta.photoConsent) throw HttpError.unprocessable('api.fotos.sinConsentimiento');

  const registro = await prisma.photoRecord.create({
    data: {
      patientId: datos.patientId,
      serviceId: datos.serviceId || null,
      title: datos.title,
      notes: datos.notes || null,
      consentSigned: datos.consentSigned,
      publishable: datos.publishable,
      createdById: sesion.sub,
      photos: {
        create: datos.fotos.map((foto, indice) => ({
          url: foto.url,
          type: foto.type,
          angle: foto.angle,
          caption: foto.caption || null,
          takenAt: foto.takenAt ? new Date(foto.takenAt) : undefined,
          sortOrder: foto.sortOrder || indice,
        })),
      },
    },
    include: CON_FOTOS,
  });

  return NextResponse.json(registro, { status: 201 });
});
