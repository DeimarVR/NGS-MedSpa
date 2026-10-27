import { z } from 'zod';
import { AppointmentSource, Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { enumDeLocale } from '@/lib/idiomas';
import * as service from '@/server/modules/appointments/appointments.service';
import { idiomaDe } from '@/server/i18n';
import { traducirTratamientos } from '@/server/modules/treatments/traduccion';
import { body, requireAuth, requireRole, route, t } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const cita = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      service: { select: { id: true, name: true, slug: true, durationMin: true, category: true, translations: true } },
      patient: { select: { id: true, fullName: true, publicToken: true, phone: true, email: true } },
    },
  });
  if (!cita) throw HttpError.notFound('api.citas.noEncontrada');
  return { appointment: traducirTratamientos(cita, idiomaDe(req)), manageUrl: service.enlaceDeGestion(cita) };
});

const editarSchema = z
  .object({
    /** Enlazar (o soltar) la ficha de la clienta. */
    patientId: z.string().nullable(),
    contactName: z.string().trim().min(2, 'v.nombreClienta').max(120),
    contactEmail: z.email('v.correo').nullable().or(z.literal('')),
    message: z.string().trim().max(1000).nullable(),
    source: z.enum(AppointmentSource),
    locale: z.enum(['es', 'en', 'fr', 'ar', 'ja']),
  })
  .partial();

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const datos = await body(req, editarSchema);
  if (datos.patientId) {
    const existe = await prisma.patient.findUnique({ where: { id: datos.patientId }, select: { id: true } });
    if (!existe) throw HttpError.notFound('api.clientas.noEncontrada');
  }
  return prisma.appointment.update({
    where: { id: params.id },
    data: {
      ...(datos.patientId !== undefined ? { patientId: datos.patientId } : {}),
      ...(datos.contactName !== undefined ? { contactName: datos.contactName } : {}),
      ...(datos.contactEmail !== undefined ? { contactEmail: datos.contactEmail || null } : {}),
      ...(datos.message !== undefined ? { message: datos.message || null } : {}),
      ...(datos.source !== undefined ? { source: datos.source } : {}),
      ...(datos.locale !== undefined ? { locale: enumDeLocale(datos.locale) } : {}),
    },
  });
});

/** Cancelar desde el panel (pasa por la misma función que el enlace de la clienta). */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.RECEPCION, Role.PROFESIONAL);
  const cita = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (cita) await service.cancelByToken(cita.manageToken, t(req)('api.citas.canceladaDesdePanel'));
  return { ok: true };
});
