import { z } from 'zod';
import { env } from '@/server/config/env';
import { toZonedDateKey } from '@/server/lib/datetime';
import { query, requireAuth, route, t } from '@/server/http';
import { armarExcel, respuestaDeDescarga } from '@/server/modules/exportar/excel';
import { hojaPorCobrar } from '@/server/modules/exportar/hojas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const consulta = query(req, z.object({ q: z.string().trim().min(1).optional() }));
  const tr = t(req);
  const archivo = await armarExcel(await hojaPorCobrar(tr, consulta));
  return respuestaDeDescarga(archivo, `${tr('excel.archivoPorCobrar')} ${toZonedDateKey(new Date(), env.CLINIC_TIMEZONE)}.xlsx`);
});
