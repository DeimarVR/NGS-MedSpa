import { z } from 'zod';
import * as avisos from '@/server/services/avisos';
import { idiomaDe } from '@/server/i18n';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** La campana: lo que hay que mirar hoy, ya escrito en el idioma del panel. */
export const GET = route(async (req) => {
  const sesion = requireAuth(req);
  return avisos.avisosDe(sesion.sub, idiomaDe(req));
});

const vistosSchema = z.object({
  /** Qué se marca. Sin esto, todo lo que hay ahora. */
  claves: z.array(z.string().trim().min(1).max(160)).max(500).optional(),
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, vistosSchema);
  return avisos.marcarVistos(sesion.sub, idiomaDe(req), datos.claves);
});
