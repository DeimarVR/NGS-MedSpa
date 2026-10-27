import { Role } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { tokenDeEnlace } from '@/server/lib/tokens';
import { localeDeEnum } from '@/lib/idiomas';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cambia el enlace de seguimiento: el viejo deja de funcionar al instante. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const patient = await prisma.patient.update({ where: { id: params.id }, data: { publicToken: tokenDeEnlace() } });
  return {
    publicToken: patient.publicToken,
    trackingUrl: `${env.PUBLIC_WEB_URL}/${localeDeEnum(patient.preferredLocale)}/seguimiento/${patient.publicToken}`,
  };
});
