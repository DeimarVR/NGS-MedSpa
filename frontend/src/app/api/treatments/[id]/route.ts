import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, requireRole, route, t } from '@/server/http';
import { serviceSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const datos = await body(req, serviceSchema.partial());
  return prisma.service.update({ where: { id: params.id }, data: datos });
});

/** No se borra: lo usan citas, mapas y recibos. Se desactiva. */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  await prisma.service.update({ where: { id: params.id }, data: { active: false, published: false } });
  return { message: t(req)('api.tratamientos.desactivado') };
});
