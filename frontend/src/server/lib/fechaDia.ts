import { z } from 'zod';

/**
 * Fechas SIN HORA (un recibo, una sesión): se guardan a medianoche UTC y se
 * leen en UTC. Si se guardara la hora local, un documento creado a las 8 de la
 * noche en Dallas (UTC-5/-6) quedaría con la fecha del día siguiente.
 */
export const claveFechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'v.fechaInvalida')
  // Que EXISTA: `Date.parse` acepta «2026-02-31» y lo corre al 3 de marzo.
  .refine((valor) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return true;
    const [a, m, d] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(a, m - 1, d));
    return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
  }, 'v.fechaNoExiste');

export function fechaDesdeClave(clave: string): Date {
  return new Date(`${clave}T00:00:00.000Z`);
}

export function claveDesdeFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}
