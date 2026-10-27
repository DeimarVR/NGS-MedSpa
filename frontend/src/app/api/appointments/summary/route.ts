import { AppointmentStatus } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { env } from '@/server/config/env';
import { addDays, parseZonedDateTime, toZonedDateKey } from '@/server/lib/datetime';
import { requireAuth, route } from '@/server/http';
import { idiomaDe } from '@/server/i18n';
import { traducirTratamientos } from '@/server/modules/treatments/traduccion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Números del tablero: hoy, esta semana, sin confirmar y las próximas. */
export const GET = route(async (req) => {
  requireAuth(req);
  const now = new Date();
  const zona = env.CLINIC_TIMEZONE;
  const inicioDeHoy = parseZonedDateTime(toZonedDateKey(now, zona), '00:00', zona);
  const medianocheEn = (dias: number) => parseZonedDateTime(toZonedDateKey(addDays(inicioDeHoy, dias + 0.5), zona), '00:00', zona);
  const finDeHoy = medianocheEn(1);
  const finDeSemana = medianocheEn(7);

  const [today, week, pending, upcoming, hoy] = await Promise.all([
    prisma.appointment.count({ where: { startsAt: { gte: inicioDeHoy, lt: finDeHoy }, status: { not: AppointmentStatus.CANCELADA } } }),
    prisma.appointment.count({ where: { startsAt: { gte: inicioDeHoy, lt: finDeSemana }, status: { not: AppointmentStatus.CANCELADA } } }),
    prisma.appointment.count({ where: { status: AppointmentStatus.PENDIENTE, startsAt: { gte: now } } }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: now }, status: { notIn: [AppointmentStatus.CANCELADA, AppointmentStatus.NO_ASISTIO] } },
      include: { service: { select: { name: true, translations: true } }, patient: { select: { id: true, fullName: true } } },
      orderBy: { startsAt: 'asc' },
      take: 6,
    }),
    prisma.appointment.findMany({
      where: { startsAt: { gte: inicioDeHoy, lt: finDeHoy }, status: { not: AppointmentStatus.CANCELADA } },
      include: { service: { select: { name: true, category: true, translations: true } }, patient: { select: { id: true, fullName: true } } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  return traducirTratamientos({ today, week, pending, upcoming, hoy }, idiomaDe(req));
});
