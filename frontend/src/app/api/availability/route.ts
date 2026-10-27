import { z } from 'zod';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { toZonedDateKey } from '@/server/lib/datetime';
import { MAX_ADVANCE_DAYS, getAvailability } from '@/server/services/availability';
import { query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  serviceId: z.string().min(1),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.coerce.number().int().min(1).max(31).default(1),
  excluir: z.string().optional(),
});

/** Disponibilidad para el panel: sin anticipación mínima ni tope de días. */
export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);
  const servicio = await prisma.service.findFirst({ where: { OR: [{ id: q.serviceId }, { slug: q.serviceId }], active: true } });
  if (!servicio) throw HttpError.notFound('api.tratamientos.noEncontrado');

  return {
    service: { id: servicio.id, name: servicio.name, durationMin: servicio.durationMin },
    timezone: env.CLINIC_TIMEZONE,
    maxAdvanceDays: MAX_ADVANCE_DAYS,
    days: await getAvailability({
      fromDate: q.from ?? toZonedDateKey(new Date(), env.CLINIC_TIMEZONE),
      days: q.days,
      durationMin: servicio.durationMin,
      desdeElPanel: true,
      excluirCita: q.excluir,
    }),
  };
});
