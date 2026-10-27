import { AppointmentStatus } from '@/generated/prisma/client';
import type { Locale } from '@/i18n/routing';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { leerAjuste } from '../../ajustes';
import { traducirServicio } from '../treatments/traduccion';
import { calcularRetoques } from '../retoques/retoques.service';

/**
 * El enlace de seguimiento de la clienta (/seguimiento/<token>), sin cuenta.
 *
 * Muestra SOLO lo que es para ella: sus visitas con las indicaciones de
 * cuidado, sus próximas citas y cuándo le toca el retoque. Nada de notas
 * internas, lotes ni fotos: un enlace que se reenvía por error no puede
 * enseñar la historia clínica.
 */
export async function getPatientProgress(publicToken: string, locale: Locale) {
  const patient = await prisma.patient.findUnique({
    where: { publicToken },
    include: {
      records: {
        orderBy: { procedureDate: 'desc' },
        take: 12,
        select: {
          id: true,
          procedureDate: true,
          aftercare: true,
          nextControl: true,
          service: { select: { name: true, shortDesc: true, description: true, translations: true } },
        },
      },
      appointments: {
        where: { startsAt: { gte: new Date() }, status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] } },
        include: { service: { select: { name: true, shortDesc: true, description: true, translations: true } } },
        orderBy: { startsAt: 'asc' },
        take: 5,
      },
    },
  });

  if (!patient || !patient.active) throw HttpError.notFound('api.seguimiento.enlaceInvalido');

  const retoques = await calcularRetoques({ patientId: patient.id, locale, todos: true });

  return {
    patient: {
      firstName: patient.fullName.split(' ')[0],
      fullName: patient.fullName,
      memberSince: patient.createdAt,
    },
    visitas: patient.records.map((r) => ({
      id: r.id,
      fecha: r.procedureDate,
      tratamiento: r.service ? traducirServicio(r.service, locale).name : '',
      indicaciones: r.aftercare,
      proximo: r.nextControl,
    })),
    proximasCitas: patient.appointments.map((a) => ({
      id: a.id,
      serviceName: traducirServicio(a.service, locale).name,
      startsAt: a.startsAt,
      status: a.status,
      manageToken: a.manageToken,
    })),
    retoques: retoques.map((r) => ({ serviceName: r.serviceName, tocaEl: r.tocaEl })),
    clinic: { name: env.CLINIC_NAME, phone: await leerAjuste('telefono').catch(() => ''), address: env.CLINIC_ADDRESS },
  };
}
