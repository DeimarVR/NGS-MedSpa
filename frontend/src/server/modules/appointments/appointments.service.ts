import { AppointmentSource, AppointmentStatus, type Appointment } from '@/generated/prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { addMinutes } from '../../lib/datetime';
import { normalizePhone } from '../../lib/phone';
import { tokenDeEnlace } from '../../lib/tokens';
import { createLogger } from '../../lib/logger';
import { assertSlotIsFree } from '../../services/availability';
import { leerAjuste } from '../../ajustes';
import { enumDeLocale, localeDeEnum } from '@/lib/idiomas';
import { traducirServicio } from '../treatments/traduccion';

const log = createLogger('citas');

export interface CreateBookingInput {
  serviceId: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  message?: string;
  startsAt: Date;
  source?: AppointmentSource;
  patientId?: string;
  locale?: string;
  /** Desde el panel no hay anticipación mínima ni tope de días. */
  desdeElPanel?: boolean;
  /** La cita nace confirmada (la agendó el equipo con la clienta delante). */
  confirmada?: boolean;
}

export interface BookingResult {
  appointment: Appointment;
  manageUrl: string;
}

/** Enlace para que la clienta confirme o cancele, en su idioma. */
export function enlaceDeGestion(cita: Pick<Appointment, 'manageToken' | 'locale'>): string {
  return `${env.PUBLIC_WEB_URL}/${localeDeEnum(cita.locale)}/cita/${cita.manageToken}`;
}

/**
 * Segunda comprobación, DESPUÉS de crear: dos personas pudieron pedir el mismo
 * cupo a la vez y las dos pasar la primera. Se queda la que llegó antes; la
 * otra se borra y recibe un «se acaba de llenar».
 */
async function quedaSiCabe(cita: { id: string; startsAt: Date; endsAt: Date; createdAt: Date }, desdeElPanel?: boolean): Promise<void> {
  const despues = await prisma.appointment.findMany({
    where: {
      id: { not: cita.id },
      startsAt: { lt: cita.endsAt },
      endsAt: { gt: cita.startsAt },
      OR: [{ createdAt: { gt: cita.createdAt } }, { createdAt: cita.createdAt, id: { gt: cita.id } }],
    },
    select: { id: true },
  });
  try {
    await assertSlotIsFree(cita.startsAt, cita.endsAt, {
      desdeElPanel: true,
      excluirCitas: [cita.id, ...despues.map((d) => d.id)],
    });
  } catch (fallo) {
    if (!(fallo instanceof HttpError) || fallo.status !== 409) {
      log.warn('no se pudo hacer la segunda comprobación de cupo: la cita se queda', String(fallo).slice(0, 150));
      return;
    }
    await prisma.appointment.delete({ where: { id: cita.id } }).catch(() => null);
    throw HttpError.conflict(desdeElPanel ? 'api.agenda.ocupadoALaVez' : 'api.agenda.seLleno');
  }
}

export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service || !service.active) throw HttpError.badRequest('api.agenda.tratamientoNoDisponible');

  const phone = normalizePhone(input.contactPhone);
  const startsAt = input.startsAt;
  const endsAt = addMinutes(startsAt, service.durationMin);

  await assertSlotIsFree(startsAt, endsAt, { desdeElPanel: input.desdeElPanel });

  // Si la reserva no trae ficha, se enlaza a la clienta con ese teléfono si
  // hay UNA sola: con dos fichas con el mismo número no se adivina.
  let patientId = input.patientId ?? null;
  if (!patientId) {
    const mismas = await prisma.patient.findMany({ where: { phone, active: true }, select: { id: true }, take: 2 });
    if (mismas.length === 1) patientId = mismas[0].id;
  }

  const appointment = await prisma.appointment.create({
    data: {
      serviceId: service.id,
      patientId,
      contactName: input.contactName.trim(),
      contactPhone: phone,
      contactEmail: input.contactEmail?.trim().toLowerCase() || null,
      message: input.message?.trim() || null,
      locale: enumDeLocale(input.locale),
      startsAt,
      endsAt,
      manageToken: tokenDeEnlace(),
      status: input.confirmada ? AppointmentStatus.CONFIRMADA : AppointmentStatus.PENDIENTE,
      source: input.source ?? AppointmentSource.WEB,
    },
  });

  await quedaSiCabe(appointment, input.desdeElPanel);

  return { appointment, manageUrl: enlaceDeGestion(appointment) };
}

export async function getByManageToken(manageToken: string, locale: Parameters<typeof traducirServicio>[1]) {
  const appointment = await prisma.appointment.findUnique({
    where: { manageToken },
    include: { service: { select: { name: true, durationMin: true, slug: true, shortDesc: true, description: true, translations: true } } },
  });
  if (!appointment) throw HttpError.notFound('api.citas.noEncontrada');

  const servicio = traducirServicio(appointment.service, locale);
  return {
    id: appointment.id,
    contactName: appointment.contactName,
    service: { name: servicio.name, durationMin: servicio.durationMin, slug: servicio.slug },
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    clinic: {
      name: env.CLINIC_NAME,
      address: env.CLINIC_ADDRESS,
      phone: await leerAjuste('telefono').catch(() => ''),
    },
  };
}

export async function confirmByToken(manageToken: string) {
  const appointment = await prisma.appointment.findUnique({ where: { manageToken } });
  if (!appointment) throw HttpError.notFound('api.citas.noEncontrada');
  if (appointment.status === AppointmentStatus.CANCELADA) throw HttpError.conflict('api.citas.yaCancelada');
  if (appointment.status !== AppointmentStatus.PENDIENTE) return appointment;
  return prisma.appointment.update({ where: { id: appointment.id }, data: { status: AppointmentStatus.CONFIRMADA } });
}

/**
 * Cancela una cita. Por aquí pasan TODAS las cancelaciones (enlace de la
 * clienta y panel), para que `cancelledAt` sea siempre la fecha real.
 */
export async function cancelByToken(manageToken: string, motivo?: string) {
  const appointment = await prisma.appointment.findUnique({ where: { manageToken } });
  if (!appointment) throw HttpError.notFound('api.citas.noEncontrada');
  if (appointment.status === AppointmentStatus.CANCELADA) return appointment;
  if (appointment.status === AppointmentStatus.COMPLETADA) throw HttpError.conflict('api.citas.yaAtendida');

  return prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELADA,
      cancelledAt: new Date(),
      message: motivo ? `${appointment.message ?? ''}\n[×] ${motivo}`.trim() : appointment.message,
    },
  });
}

export async function reschedule(appointmentId: string, newStartsAt: Date, opciones: { desdeElPanel?: boolean; quedaConfirmada?: boolean } = {}) {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId }, include: { service: true } });
  if (!appointment) throw HttpError.notFound('api.citas.noEncontrada');

  const newEndsAt = addMinutes(newStartsAt, appointment.service.durationMin);
  await assertSlotIsFree(newStartsAt, newEndsAt, { desdeElPanel: opciones.desdeElPanel, excluirCita: appointment.id });

  return prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      startsAt: newStartsAt,
      endsAt: newEndsAt,
      status: opciones.quedaConfirmada ? AppointmentStatus.CONFIRMADA : AppointmentStatus.PENDIENTE,
      reminderSentAt: null,
      cancelledAt: null,
    },
  });
}
