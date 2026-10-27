import { AppointmentStatus } from '@/generated/prisma/client';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { createLogger } from './lib/logger';
import { ventanaDeManana } from './lib/datetime';
import { calcularRetoques } from './modules/retoques/retoques.service';

const log = createLogger('cron');

/**
 * La tarea diaria (Vercel Cron, ver `vercel.json`).
 *
 * Hoy NO manda mensajes: el canal de avisos a la clienta (WhatsApp con
 * plantillas, SMS o correo) está pendiente de decidir con la clínica. Cuando se
 * decida, los recordatorios de mañana y los retoques salen de aquí, marcando
 * `reminderSentAt` para no repetir si Vercel corre la tarea dos veces.
 */

/** Las claves de «envío único» solo sirven unos minutos; pasada una semana, sobran. */
export async function limpiarEnvios(): Promise<string> {
  const { count } = await prisma.setting.deleteMany({
    where: { key: { startsWith: 'envio:' }, updatedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } },
  });
  return `claves de envío borradas: ${count}`;
}

/** Lo que el equipo tendría que avisar hoy, para el registro (y para el día que haya canal). */
export async function resumenDelDia(): Promise<string> {
  const { desde, hasta } = ventanaDeManana(env.CLINIC_TIMEZONE);
  const [manana, sinAviso, retoques] = await Promise.all([
    prisma.appointment.count({
      where: { startsAt: { gte: desde, lt: hasta }, status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] } },
    }),
    prisma.appointment.count({
      where: {
        startsAt: { gte: desde, lt: hasta },
        status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
        reminderSentAt: null,
      },
    }),
    calcularRetoques({ margenDias: 0 }).then((l) => l.length),
  ]);
  return `citas mañana: ${manana} (${sinAviso} sin recordatorio) · retoques que tocan: ${retoques}`;
}

/** Cada tarea se aísla: que una falle no impide las demás. */
export async function runDailyJobs(): Promise<Record<string, string>> {
  const salida: Record<string, string> = {};
  for (const [nombre, tarea] of [
    ['limpieza', limpiarEnvios],
    ['resumen', resumenDelDia],
  ] as const) {
    try {
      salida[nombre] = await tarea();
    } catch (error) {
      log.error(`La tarea "${nombre}" falló`, error);
      salida[nombre] = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  log.info('tarea diaria', salida);
  return salida;
}
