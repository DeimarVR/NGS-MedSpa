import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const atenderSchema = z.object({ handled: z.boolean() });

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const { handled } = await body(req, atenderSchema);
  return prisma.contactMessage.update({ where: { id: params.id }, data: { handled } });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  await prisma.contactMessage.delete({ where: { id: params.id } });
  return { ok: true };
});
