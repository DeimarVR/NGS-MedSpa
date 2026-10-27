import { AppointmentStatus } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { ventanaDeManana } from '@/server/lib/datetime';
import { requireAuth, route } from '@/server/http';
import { idiomaDe } from '@/server/i18n';
import { traducirTratamientos } from '@/server/modules/treatments/traduccion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las citas de MAÑANA (en el calendario de la clínica, no «dentro de 24 h»),
 * para recordárselas. Las marca quien las avisa.
 */
export const GET = route(async (req) => {
  requireAuth(req);
  const { desde, hasta, clave } = ventanaDeManana(env.CLINIC_TIMEZONE);

  const items = await prisma.appointment.findMany({
    where: { startsAt: { gte: desde, lt: hasta }, status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] } },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      startsAt: true,
      status: true,
      locale: true,
      reminderSentAt: true,
      service: { select: { id: true, name: true, translations: true } },
      patient: { select: { id: true, fullName: true } },
    },
  });

  return { items: traducirTratamientos(items, idiomaDe(req)), pendientes: items.filter((c) => !c.reminderSentAt).length, fecha: clave };
});
