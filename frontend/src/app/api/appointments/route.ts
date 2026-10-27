import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppointmentSource, AppointmentStatus } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { env } from '@/server/config/env';
import { HttpError } from '@/server/lib/httpError';
import { addDays, parseZonedDateTime, toZonedDateKey } from '@/server/lib/datetime';
import * as service from '@/server/modules/appointments/appointments.service';
import { body, query, requireAuth, route } from '@/server/http';
import { idiomaDe } from '@/server/i18n';
import { traducirTratamientos } from '@/server/modules/treatments/traduccion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  periodo: z.enum(['proximas', 'pasadas', 'todas']).default('proximas'),
  dia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Varios días seguidos de la clínica (la vista de semana). */
  desdeDia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dias: z.coerce.number().int().min(1).max(42).default(7),
  status: z.enum(AppointmentStatus).optional(),
  patientId: z.string().optional(),
  q: z.string().trim().min(1).optional(),
  take: z.coerce.number().int().min(1).max(500).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

/** Medianoche a medianoche de un día de la clínica (con cambio de hora incluido). */
function ventanaDelDia(clave: string): { gte: Date; lt: Date } {
  const desde = parseZonedDateTime(clave, '00:00', env.CLINIC_TIMEZONE);
  const siguiente = toZonedDateKey(addDays(desde, 1.5), env.CLINIC_TIMEZONE);
  return { gte: desde, lt: parseZonedDateTime(siguiente, '00:00', env.CLINIC_TIMEZONE) };
}

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listQuerySchema);

  const inicioDeHoy = parseZonedDateTime(toZonedDateKey(new Date(), env.CLINIC_TIMEZONE), '00:00', env.CLINIC_TIMEZONE);

  const rango = q.desdeDia
    ? {
        startsAt: {
          gte: ventanaDelDia(q.desdeDia).gte,
          lt: ventanaDelDia(toZonedDateKey(addDays(parseZonedDateTime(q.desdeDia, '12:00', env.CLINIC_TIMEZONE), q.dias - 1), env.CLINIC_TIMEZONE)).lt,
        },
      }
    : q.dia
      ? { startsAt: ventanaDelDia(q.dia) }
    : q.from || q.to
      ? { startsAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
      : q.periodo === 'proximas'
        ? { startsAt: { gte: inicioDeHoy } }
        : q.periodo === 'pasadas'
          ? { startsAt: { lt: inicioDeHoy } }
          : {};

  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.patientId ? { patientId: q.patientId } : {}),
    ...rango,
    ...(q.q
      ? {
          OR: [
            { contactName: { contains: q.q, mode: 'insensitive' as const } },
            { contactPhone: { contains: q.q.replace(/\D/g, '') || q.q } },
            { contactEmail: { contains: q.q, mode: 'insensitive' as const } },
            { patient: { fullName: { contains: q.q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, slug: true, durationMin: true, category: true, translations: true } },
        patient: { select: { id: true, fullName: true, publicToken: true } },
      },
      orderBy: { startsAt: q.periodo === 'pasadas' && !q.dia && !q.from && !q.to ? 'desc' : 'asc' },
      take: q.take,
      skip: q.skip,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items: traducirTratamientos(items, idiomaDe(req)), total, take: q.take, skip: q.skip };
});

const createSchema = z.object({
  serviceId: z.string().min(1, 'v.elegirTratamiento'),
  contactName: z.string().trim().min(2, 'v.nombreClienta').max(120),
  contactPhone: z.string().trim().min(7, 'v.telefonoObligatorio').max(30),
  contactEmail: z.email('v.correo').optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'v.elegirFecha'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'v.elegirHora'),
  patientId: z.string().optional(),
  source: z.enum(AppointmentSource).default(AppointmentSource.PRESENCIAL),
  locale: z.enum(['es', 'en', 'fr', 'ar', 'ja']).optional(),
  confirmada: z.boolean().default(true),
});

export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, createSchema);

  let startsAt: Date;
  try {
    startsAt = parseZonedDateTime(datos.fecha, datos.hora, env.CLINIC_TIMEZONE);
  } catch {
    throw HttpError.badRequest('api.agenda.fechaHoraInvalidas');
  }

  // El idioma: el que se elija, o el de la ficha de la clienta.
  let locale = datos.locale as string | undefined;
  if (!locale && datos.patientId) {
    const ficha = await prisma.patient.findUnique({ where: { id: datos.patientId }, select: { preferredLocale: true } });
    locale = ficha?.preferredLocale.toLowerCase();
  }

  const result = await service.createBooking({
    serviceId: datos.serviceId,
    contactName: datos.contactName,
    contactPhone: datos.contactPhone,
    contactEmail: datos.contactEmail || undefined,
    message: datos.message,
    patientId: datos.patientId || undefined,
    startsAt,
    source: datos.source,
    locale,
    desdeElPanel: true,
    confirmada: datos.confirmada,
  });

  return NextResponse.json(result, { status: 201 });
});
