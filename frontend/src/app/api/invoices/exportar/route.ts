import { query, requireAuth, route, t } from '@/server/http';
import { armarExcel, respuestaDeDescarga } from '@/server/modules/exportar/excel';
import { hojasDeRecibos } from '@/server/modules/exportar/hojas';
import { listadoSchema } from '../esquema';
import { rangoDelListado } from '../periodo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listadoSchema);
  const { fecha, desde, hasta } = rangoDelListado(q);
  const tr = t(req);
  const archivo = await armarExcel(await hojasDeRecibos(tr, { q: q.q, type: q.type, status: q.status, desde, hasta }));
  const etiqueta = q.periodo === 'todo' ? tr('excel.historico') : `${q.periodo}-${fecha}`;
  return respuestaDeDescarga(archivo, `${tr('excel.archivoRecibos')} ${etiqueta}.xlsx`);
});
