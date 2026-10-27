import { z } from 'zod';
import { buscarFichas } from '@/server/modules/patients/busqueda.service';
import { query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Buscador rápido de clientas (para elegirla en una cita, un recibo, un mapa…). */
export const GET = route(async (req) => {
  requireAuth(req);
  const { q } = query(req, z.object({ q: z.string().default('') }));
  return { items: await buscarFichas(q) };
});
