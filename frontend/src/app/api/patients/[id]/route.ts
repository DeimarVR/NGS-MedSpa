import { Role } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { localeDeEnum } from '@/lib/idiomas';
import { traductor } from '@/server/i18n';
import { body, requireAuth, requireRole, route, t } from '@/server/http';
import { archivarClienta } from '@/server/modules/patients/borrado.service';
import { patientUpdateSchema } from '../esquema';
import { datosDeClienta } from '../datos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      plans: {
        include: {
          service: { select: { id: true, name: true, slug: true } },
          sessions: { orderBy: { sessionNumber: 'asc' }, include: { professional: { select: { id: true, fullName: true } } } },
        },
        orderBy: { startDate: 'desc' },
      },
    },
  });
  if (!patient) throw HttpError.notFound('api.clientas.noEncontrada');

  const locale = localeDeEnum(patient.preferredLocale);
  const trackingUrl = `${env.PUBLIC_WEB_URL}/${locale}/seguimiento/${patient.publicToken}`;
  return {
    ...patient,
    preferredLocale: locale,
    trackingUrl,
    // El mensaje para mandarle su enlace, en SU idioma.
    trackingMessage: traductor(locale)('mensajesClienta.seguimiento', {
      nombre: patient.fullName.split(' ')[0],
      clinica: env.CLINIC_NAME,
      enlace: trackingUrl,
    }),
  };
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const usuario = requireAuth(req);
  const datos = await body(req, patientUpdateSchema);
  if (datos.active !== undefined && usuario.role !== Role.ADMIN) throw HttpError.forbidden('api.clientas.soloAdminArchiva');
  return prisma.patient.update({ where: { id: params.id }, data: datosDeClienta(datos) });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const { nombre } = await archivarClienta(params.id);
  return { message: t(req)('api.clientas.archivada', { nombre }) };
});
