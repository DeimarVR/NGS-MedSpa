import { AppointmentSource, AppointmentStatus, type Appointment } from '@/generated/prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError, type Valores } from '../../lib/httpError';
import { parseZonedDateTime } from '../../lib/datetime';
import { createLogger } from '../../lib/logger';
import { localeDeEnum } from '@/lib/idiomas';
import * as citas from '../appointments/appointments.service';

const log = createLogger('proximo-control');

const VIVAS: AppointmentStatus[] = [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA];

/** Un aviso para la pantalla: clave de traducción y sus valores. */
export interface AvisoAgenda {
  clave: string;
  valores?: Valores;
}

export async function cancelarCitasDeControl(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const vivas = await prisma.appointment.findMany({
    where: { id: { in: ids }, status: { in: VIVAS }, startsAt: { gt: new Date() } },
    select: { id: true },
  });
  for (const cita of vivas) {
    await prisma.appointment
      .update({ where: { id: cita.id }, data: { status: AppointmentStatus.CANCELADA, cancelledAt: new Date() } })
      .catch((e) => log.warn('no se pudo cancelar la cita de un control quitado', String(e).slice(0, 120)));
  }
}

/**
 * El «próximo control» de una ficha: si se llena fecha, hora y tratamiento,
 * se agenda SOLO; si se cambia, la cita se MUEVE en vez de duplicarse; si se
 * borra, la cita se cancela.
 *
 * Devuelve el id de la cita que queda enlazada (o null) y, si algo no se pudo
 * hacer, un aviso para mostrar: la ficha se guarda igual.
 */
export async function sincronizarProximoControl(entrada: {
  fecha: Date | null;
  hora: string | null;
  serviceId: string | null;
  citaActual: Pick<Appointment, 'id' | 'status' | 'serviceId' | 'startsAt'> | null;
  paciente: { id: string; nombre: string; telefono: string; locale: string };
  nota: string;
}): Promise<{ appointmentId: string | null; aviso?: AvisoAgenda }> {
  const { fecha, hora, serviceId, citaActual } = entrada;
  const viva = Boolean(citaActual && VIVAS.includes(citaActual.status));
  const quiereCita = Boolean(fecha && hora && serviceId);

  if (!quiereCita) {
    if (citaActual && viva) await cancelarCitasDeControl([citaActual.id]);
    return { appointmentId: null };
  }

  let inicio: Date;
  try {
    inicio = parseZonedDateTime(fecha!.toISOString().slice(0, 10), hora!, env.CLINIC_TIMEZONE);
  } catch {
    return { appointmentId: citaActual?.id ?? null, aviso: { clave: 'api.control.horaInvalida' } };
  }
  if (inicio.getTime() <= Date.now()) {
    return { appointmentId: citaActual?.id ?? null, aviso: { clave: 'api.control.yaPaso' } };
  }

  if (citaActual && viva) {
    const mismoMomento = citaActual.startsAt.getTime() === inicio.getTime();
    const mismoServicio = citaActual.serviceId === serviceId;
    if (mismoMomento && mismoServicio) return { appointmentId: citaActual.id };
    if (mismoServicio) {
      try {
        await citas.reschedule(citaActual.id, inicio, { desdeElPanel: true, quedaConfirmada: true });
        return { appointmentId: citaActual.id };
      } catch (error) {
        return {
          appointmentId: citaActual.id,
          aviso: { clave: 'api.control.noSeMovio', valores: { motivo: error instanceof HttpError ? error.message : '' } },
        };
      }
    }
  }

  try {
    const reserva = await citas.createBooking({
      serviceId: serviceId!,
      contactName: entrada.paciente.nombre,
      contactPhone: entrada.paciente.telefono,
      patientId: entrada.paciente.id,
      startsAt: inicio,
      source: AppointmentSource.PRESENCIAL,
      message: entrada.nota,
      locale: localeDeEnum(entrada.paciente.locale),
      desdeElPanel: true,
      confirmada: true,
    });
    if (citaActual && viva) await cancelarCitasDeControl([citaActual.id]);
    return { appointmentId: reserva.appointment.id };
  } catch (error) {
    log.warn('no se pudo agendar el próximo control', String(error).slice(0, 160));
    return {
      appointmentId: citaActual && viva ? citaActual.id : null,
      aviso: { clave: 'api.control.noSeAgendo', valores: { motivo: error instanceof HttpError ? error.message : '' } },
    };
  }
}
