import { z } from 'zod';
import * as caja from '@/server/modules/caja/caja.service';
import { query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ¿Está cerrado ese día? (para avisar antes de registrar un pago en él). */
export const GET = route(async (req) => {
  requireAuth(req);
  const { fecha } = query(req, z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }));
  const cierre = await caja.cierreDelDia(fecha);
  return { fecha, cerrado: Boolean(cierre), cerradoPor: cierre?.closedBy?.fullName ?? null, cerradoEl: cierre?.closedAt ?? null };
});
