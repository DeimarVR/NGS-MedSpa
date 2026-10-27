import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppointmentStatus, Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, query, requireAuth, requireRole, route } from '@/server/http';
import { idiomaDe } from '@/server/i18n';
import { traducirTratamientos } from '@/server/modules/treatments/traduccion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Días u horas bloqueadas: feriados, vacaciones, cursos. */
export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, z.object({ desde: z.iso.datetime().optional(), hasta: z.iso.datetime().optional() }));
  const desde = q.desde ? new Date(q.desde) : new Date(Date.now() - 86_400_000);
  return {
    items: await prisma.blackout.findMany({
      where: { endsAt: { gt: desde }, ...(q.hasta ? { startsAt: { lt: new Date(q.hasta) } } : {}) },
      orderBy: { startsAt: 'asc' },
      take: 200,
    }),
  };
});

const bloqueoSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    reason: z.string().trim().max(160).optional().nullable(),
  })
  .refine((b) => new Date(b.endsAt) > new Date(b.startsAt), { message: 'v.finDespues', path: ['endsAt'] });

/**
 * Bloquea un tramo. Las citas que ya estaban en ese tramo NO se tocan: se
 * devuelven para que el equipo las mueva una por una y le avise a cada clienta.
 */
export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN, Role.RECEPCION);
  const datos = await body(req, bloqueoSchema);
  const startsAt = new Date(datos.startsAt);
  const endsAt = new Date(datos.endsAt);
  const [bloqueo, afectadas] = await Promise.all([
    prisma.blackout.create({ data: { startsAt, endsAt, reason: datos.reason || null } }),
    prisma.appointment.findMany({
      where: {
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
      },
      select: { id: true, contactName: true, startsAt: true, service: { select: { name: true, translations: true } } },
      orderBy: { startsAt: 'asc' },
    }),
  ]);
  return NextResponse.json({ bloqueo, afectadas: traducirTratamientos(afectadas, idiomaDe(req)) }, { status: 201 });
});
