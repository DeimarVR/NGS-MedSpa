import { z } from 'zod';
import * as caja from '@/server/modules/caja/caja.service';
import { query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodo: z.enum(['dia', 'semana', 'mes']).default('dia'),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);
  const { desde, hasta } = caja.rangoDelPeriodo(q.fecha, q.periodo);
  const [resumen, pagos, cierre] = await Promise.all([
    caja.resumenCaja(desde, hasta),
    caja.listarPagos(desde, hasta),
    q.periodo === 'dia' ? caja.cierreDelDia(q.fecha) : Promise.resolve(null),
  ]);
  return { periodo: q.periodo, fecha: q.fecha, resumen, pagos, cierre };
});
