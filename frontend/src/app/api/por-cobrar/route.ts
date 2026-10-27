import { z } from 'zod';
import { clientasQueDeben } from '@/server/modules/invoices/porCobrar.service';
import { query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  return clientasQueDeben(query(req, z.object({ q: z.string().trim().min(1).optional() })));
});
