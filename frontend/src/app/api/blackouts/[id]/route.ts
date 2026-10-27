import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.RECEPCION);
  const { count } = await prisma.blackout.deleteMany({ where: { id: params.id } });
  if (count === 0) throw HttpError.notFound();
  return { ok: true };
});
