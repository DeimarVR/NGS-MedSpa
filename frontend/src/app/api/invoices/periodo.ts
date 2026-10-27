import { env } from '@/server/config/env';
import { toZonedDateKey } from '@/server/lib/datetime';
import * as caja from '@/server/modules/caja/caja.service';
import { fechaDesdeClave } from './esquema';

const HISTORICO = { desde: new Date('2000-01-01T00:00:00.000Z'), hasta: new Date('2100-01-01T00:00:00.000Z') };
const UN_DIA = 86_400_000;

/** El rango de fechas del listado (y de la exportación), igual en los dos. */
export function rangoDelListado(q: { periodo: 'dia' | 'semana' | 'mes' | 'todo'; fecha?: string; desde?: string; hasta?: string }) {
  const fecha = q.fecha ?? toZonedDateKey(new Date(), env.CLINIC_TIMEZONE);
  const rango = q.periodo === 'todo' ? HISTORICO : caja.rangoDelPeriodo(fecha, q.periodo);
  const emision = caja.rangoDeEmision(rango.desde, rango.hasta);
  const porPeriodo = q.periodo !== 'todo';
  return {
    fecha,
    rango,
    desde: q.desde ? fechaDesdeClave(q.desde) : porPeriodo ? emision.desde : undefined,
    hasta: q.hasta ? fechaDesdeClave(q.hasta) : porPeriodo ? new Date(emision.hasta.getTime() - UN_DIA) : undefined,
  };
}
