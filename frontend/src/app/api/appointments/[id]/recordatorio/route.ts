import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { enlaceDeGestion } from '@/server/modules/appointments/appointments.service';
import { textoParaClienta } from '@/server/modules/mensajes/textos';
import { traducirServicio } from '@/server/modules/treatments/traduccion';
import { idiomaDeEnum } from '@/server/i18n';
import { body, query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tipoSchema = z.object({ tipo: z.enum(['confirmacion', 'recordatorio']).default('recordatorio') });

/** El texto del recordatorio, en el idioma de la clienta, para mandarlo a mano. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const { tipo } = query(req, tipoSchema);
  const cita = await prisma.appointment.findUnique({ where: { id: params.id }, include: { service: true } });
  if (!cita) throw HttpError.notFound('api.citas.noEncontrada');
  const servicio = traducirServicio(cita.service, idiomaDeEnum(cita.locale));
  return {
    texto: textoParaClienta(tipo, {
      nombre: cita.contactName,
      servicio: servicio.name,
      cuando: cita.startsAt,
      enlace: enlaceDeGestion(cita),
      idioma: cita.locale,
    }),
    telefono: cita.contactPhone,
    correo: cita.contactEmail,
  };
});

const marcaSchema = z.object({ enviado: z.boolean() });

/** Marcar (o desmarcar) que ya se le recordó. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const { enviado } = await body(req, marcaSchema);
  return prisma.appointment.update({
    where: { id: params.id },
    data: { reminderSentAt: enviado ? new Date() : null },
    select: { id: true, reminderSentAt: true },
  });
});
