import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { booleanoDeConsulta, query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  handled: booleanoDeConsulta.optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);
  const where = q.handled === undefined ? {} : { handled: q.handled };

  const [items, total, sinAtender] = await Promise.all([
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, take: q.take }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { handled: false } }),
  ]);

  return { items, total, sinAtender };
});
