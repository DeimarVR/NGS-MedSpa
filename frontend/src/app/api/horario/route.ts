import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { timeToMinutes } from '@/server/lib/datetime';
import { getHoursByDay } from '@/server/services/availability';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Horario de atención por día (0 = domingo … 6 = sábado). */
export const GET = route(async (req) => {
  requireAuth(req);
  const horas = await getHoursByDay();
  return {
    items: [0, 1, 2, 3, 4, 5, 6].map((dia) => {
      const h = horas[dia];
      return h
        ? { dayOfWeek: dia, active: true, openTime: h.open, closeTime: h.close, breakStart: h.breakStart ?? null, breakEnd: h.breakEnd ?? null }
        : { dayOfWeek: dia, active: false, openTime: '10:00', closeTime: '19:00', breakStart: null, breakEnd: null };
    }),
  };
});

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'v.hora');

const diaSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    active: z.boolean(),
    openTime: hora,
    closeTime: hora,
    breakStart: hora.nullish(),
    breakEnd: hora.nullish(),
  })
  .refine((d) => !d.active || timeToMinutes(d.openTime) < timeToMinutes(d.closeTime), { message: 'v.cierreDespues', path: ['closeTime'] })
  .refine(
    (d) => {
      if (!d.active || (!d.breakStart && !d.breakEnd)) return true;
      if (!d.breakStart || !d.breakEnd) return false;
      const [a, b, c, e] = [d.openTime, d.breakStart, d.breakEnd, d.closeTime].map(timeToMinutes);
      return a < b && b < c && c < e;
    },
    { message: 'v.pausaDentro', path: ['breakStart'] },
  );

const semanaSchema = z.object({
  dias: z
    .array(diaSchema)
    .length(7)
    .refine((dias) => new Set(dias.map((d) => d.dayOfWeek)).size === 7, 'v.sieteDias'),
});

export const PUT = route(async (req) => {
  requireRole(req, Role.ADMIN);
  const { dias } = await body(req, semanaSchema);
  await prisma.$transaction(
    dias.map((d) =>
      prisma.businessHour.upsert({
        where: { dayOfWeek: d.dayOfWeek },
        create: {
          dayOfWeek: d.dayOfWeek,
          active: d.active,
          openTime: d.openTime,
          closeTime: d.closeTime,
          breakStart: d.breakStart || null,
          breakEnd: d.breakEnd || null,
        },
        update: { active: d.active, openTime: d.openTime, closeTime: d.closeTime, breakStart: d.breakStart || null, breakEnd: d.breakEnd || null },
      }),
    ),
  );
  // El horario sale en la landing (que se regenera cada hora).
  revalidatePath('/', 'layout');
  return { ok: true };
});
