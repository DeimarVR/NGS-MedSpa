import { env } from '@/server/config/env';
import { query, requireAuth, route, t } from '@/server/http';
import { toZonedDateKey } from '@/server/lib/datetime';
import { armarExcel, respuestaDeDescarga } from '@/server/modules/exportar/excel';
import { hojasDeInventario } from '@/server/modules/exportar/hojas';
import { consultaInventarioSchema } from '../consulta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const consulta = query(req, consultaInventarioSchema);
  const tr = t(req);
  const archivo = await armarExcel(await hojasDeInventario(tr, consulta));
  return respuestaDeDescarga(archivo, `${tr('excel.archivoInventario')} ${toZonedDateKey(new Date(), env.CLINIC_TIMEZONE)}.xlsx`);
});
