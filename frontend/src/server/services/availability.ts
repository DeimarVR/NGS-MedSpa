import { AppointmentStatus } from '@/generated/prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/httpError';
import { leerAjuste } from '../ajustes';
import {
  addDays,
  addMinutes,
  getZonedDayOfWeek,
  minutesToTime,
  overlaps,
  parseZonedDateTime,
  timeToMinutes,
  toZonedDateKey,
  toZonedTime,
} from '../lib/datetime';
import { HORARIO_POR_DEFECTO, type Horas } from './horario';

/** Cada cuánto empieza un horario en la grilla. */
const SLOT_STEP_MINUTES = 30;

/** Con cuánta anticipación mínima se reserva desde la web (el panel no tiene tope). */
const MIN_LEAD_TIME_MINUTES = 120;

/** Hasta dónde se puede reservar desde la web. */
export const MAX_ADVANCE_DAYS = 60;

/**
 * Cuántas citas hay a la vez, como máximo, en una franja: se recorre la línea
 * de tiempo sumando inicios y restando finales. Dos citas que se tocan en el
 * borde no se pisan.
 */
export function maximoALaVez(citas: Array<{ start: Date; end: Date }>, desde: Date, hasta: Date): number {
  const marcas: Array<[number, number]> = [];
  for (const c of citas) {
    const ini = Math.max(c.start.getTime(), desde.getTime());
    const fin = Math.min(c.end.getTime(), hasta.getTime());
    if (ini < fin) marcas.push([ini, 1], [fin, -1]);
  }
  marcas.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let ahora = 0;
  let maximo = 0;
  for (const [, paso] of marcas) {
    ahora += paso;
    maximo = Math.max(maximo, ahora);
  }
  return maximo;
}

/** Cuántas clientas a la vez (ajuste `agenda.cupos`; una inyectora = 1). */
async function cuposALaVez(): Promise<number> {
  const valor = Number(await leerAjuste('cupos').catch(() => '1'));
  return Number.isInteger(valor) && valor >= 1 && valor <= 10 ? valor : 1;
}

/**
 * Una cita puede durar más que lo que queda del día (un tratamiento largo a
 * última hora). Se recorta al cierre para que el día no se quede sin horarios.
 */
function duracionDentroDelDia(duracion: number, aperturaMin: number, cierreMin: number): number {
  return Math.min(duracion, Math.max(0, cierreMin - aperturaMin));
}

export type MotivoNoDisponible = 'ocupado' | 'pausa' | 'muy-pronto' | 'muy-lejos';

export interface TimeSlot {
  time: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  motivo?: MotivoNoDisponible;
  cupos: number;
  cuposLibres: number;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  open: boolean;
  slots: TimeSlot[];
  availableCount: number;
}

interface BusyRange {
  start: Date;
  end: Date;
  id?: string;
}

async function collectBusyRanges(from: Date, to: Date) {
  const [appointments, blackouts] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startsAt: { lt: to },
        endsAt: { gt: from },
        status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
      },
      select: { id: true, startsAt: true, endsAt: true },
    }),
    prisma.blackout.findMany({
      where: { startsAt: { lt: to }, endsAt: { gt: from } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  return {
    citas: appointments.map((a): BusyRange => ({ start: a.startsAt, end: a.endsAt, id: a.id })),
    bloqueos: blackouts.map((b): BusyRange => ({ start: b.startsAt, end: b.endsAt })),
  };
}

/** Horario por día de la semana. Sin filas en la tabla, el de basico.html. */
export async function getHoursByDay(): Promise<Record<number, Horas | undefined>> {
  const todas = await prisma.businessHour.findMany();
  const mapa: Record<number, Horas | undefined> = {};
  if (todas.length === 0) {
    HORARIO_POR_DEFECTO.forEach((h, dia) => {
      if (h) mapa[dia] = h;
    });
    return mapa;
  }
  for (const fila of todas.filter((f) => f.active)) {
    mapa[fila.dayOfWeek] = {
      open: fila.openTime,
      close: fila.closeTime,
      breakStart: fila.breakStart ?? undefined,
      breakEnd: fila.breakEnd ?? undefined,
    };
  }
  return mapa;
}

export interface AvailabilityQuery {
  fromDate: string;
  days: number;
  durationMin: number;
  desdeElPanel?: boolean;
  /** La cita que se está moviendo: su propio horario cuenta como libre. */
  excluirCita?: string;
}

export async function getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
  const timeZone = env.CLINIC_TIMEZONE;
  const days = Math.min(Math.max(query.days, 1), 31);
  const duration = Math.max(query.durationMin, 15);

  const rangeStart = parseZonedDateTime(query.fromDate, '00:00', timeZone);
  const rangeEnd = addDays(rangeStart, days + 1);

  const ahora = new Date();
  const maxBookable = query.desdeElPanel ? null : addDays(ahora, MAX_ADVANCE_DAYS);
  const earliest = query.desdeElPanel ? ahora : addMinutes(ahora, MIN_LEAD_TIME_MINUTES);

  const [busy, hoursByDay, cupos] = await Promise.all([
    collectBusyRanges(rangeStart, rangeEnd),
    getHoursByDay(),
    cuposALaVez(),
  ]);

  const result: DayAvailability[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    // Con cambio de hora un día dura 23 o 25 horas: se ancla cada día a su medianoche.
    // +0,5: medio día de margen para que el día del cambio de hora (23 o 25 h) no repita ni salte la fecha.
    const dateKey = toZonedDateKey(addDays(rangeStart, dayIndex + 0.5), timeZone);
    const dayStart = parseZonedDateTime(dateKey, '12:00', timeZone);
    const dayOfWeek = getZonedDayOfWeek(dayStart, timeZone);
    const hours = hoursByDay[dayOfWeek];

    if (!hours) {
      result.push({ date: dateKey, dayOfWeek, open: false, slots: [], availableCount: 0 });
      continue;
    }

    const openMin = timeToMinutes(hours.open);
    const closeMin = timeToMinutes(hours.close);
    const breakStartMin = hours.breakStart ? timeToMinutes(hours.breakStart) : null;
    const breakEndMin = hours.breakEnd ? timeToMinutes(hours.breakEnd) : null;
    const ocupa = duracionDentroDelDia(duration, openMin, closeMin);

    const slots: TimeSlot[] = [];
    for (let minute = openMin; minute + ocupa <= closeMin && ocupa > 0; minute += SLOT_STEP_MINUTES) {
      const slotStart = parseZonedDateTime(dateKey, minutesToTime(minute), timeZone);
      const slotEnd = addMinutes(slotStart, ocupa);

      const insideBreak =
        breakStartMin !== null && breakEndMin !== null && minute < breakEndMin && minute + ocupa > breakStartMin;
      const tooSoon = slotStart < earliest;
      const tooFar = maxBookable !== null && slotStart > maxBookable;
      const bloqueado = busy.bloqueos.some((r) => overlaps(slotStart, slotEnd, r.start, r.end));
      const encima = maximoALaVez(
        query.excluirCita ? busy.citas.filter((c) => c.id !== query.excluirCita) : busy.citas,
        slotStart,
        slotEnd,
      );
      const cuposLibres = bloqueado ? 0 : Math.max(0, cupos - encima);

      const motivo: MotivoNoDisponible | undefined = tooSoon
        ? 'muy-pronto'
        : tooFar
          ? 'muy-lejos'
          : insideBreak
            ? 'pausa'
            : cuposLibres === 0
              ? 'ocupado'
              : undefined;

      slots.push({
        time: minutesToTime(minute),
        startsAt: slotStart.toISOString(),
        endsAt: slotEnd.toISOString(),
        available: motivo === undefined,
        ...(motivo ? { motivo } : {}),
        cupos,
        cuposLibres,
      });
    }

    result.push({
      date: dateKey,
      dayOfWeek,
      open: true,
      slots,
      availableCount: slots.filter((s) => s.available).length,
    });
  }

  return result;
}

export interface OpcionesDisponibilidad {
  desdeElPanel?: boolean;
  /** La cita que se está moviendo: no choca consigo misma. */
  excluirCita?: string;
  excluirCitas?: string[];
}

/**
 * Comprueba que un horario se pueda reservar. La grilla ya lo filtra, pero la
 * grilla se pidió hace un rato: otra persona pudo tomar el cupo entretanto.
 */
export async function assertSlotIsFree(startsAt: Date, endsAt: Date, opciones: OpcionesDisponibilidad = {}): Promise<void> {
  const timeZone = env.CLINIC_TIMEZONE;
  const publico = !opciones.desdeElPanel;

  if (publico && startsAt < addMinutes(new Date(), MIN_LEAD_TIME_MINUTES)) {
    throw HttpError.conflict('api.agenda.muyPronto');
  }
  if (publico && startsAt > addDays(new Date(), MAX_ADVANCE_DAYS)) {
    throw HttpError.badRequest('api.agenda.muyLejos', { dias: MAX_ADVANCE_DAYS });
  }

  const dayOfWeek = getZonedDayOfWeek(startsAt, timeZone);
  const hours = (await getHoursByDay())[dayOfWeek];
  if (!hours) throw HttpError.conflict('api.agenda.diaCerrado');

  const aperturaMin = timeToMinutes(hours.open);
  const cierreMin = timeToMinutes(hours.close);
  const startMin = timeToMinutes(toZonedTime(startsAt, timeZone));
  const duracion = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
  const finEnElDia = startMin + duracionDentroDelDia(duracion, aperturaMin, cierreMin);

  if (duracion <= 0 || startMin < aperturaMin || finEnElDia > cierreMin) {
    throw HttpError.conflict('api.agenda.fueraDeHorario');
  }

  if (hours.breakStart && hours.breakEnd) {
    const breakStart = timeToMinutes(hours.breakStart);
    const breakEnd = timeToMinutes(hours.breakEnd);
    if (startMin < breakEnd && finEnElDia > breakStart) throw HttpError.conflict('api.agenda.enPausa');
  }

  const [busy, cupos] = await Promise.all([collectBusyRanges(startsAt, endsAt), cuposALaVez()]);

  if (busy.bloqueos.some((r) => overlaps(startsAt, endsAt, r.start, r.end))) {
    throw HttpError.conflict('api.agenda.bloqueado');
  }

  const excluidas = new Set([opciones.excluirCita, ...(opciones.excluirCitas ?? [])].filter(Boolean));
  const encima = maximoALaVez(
    busy.citas.filter((r) => !excluidas.has(r.id)),
    startsAt,
    endsAt,
  );

  if (encima >= cupos) {
    throw HttpError.conflict(opciones.desdeElPanel ? 'api.agenda.lleno' : 'api.agenda.seLleno', { n: encima });
  }
}

export function claveDeHoy(): string {
  return toZonedDateKey(new Date(), env.CLINIC_TIMEZONE);
}
