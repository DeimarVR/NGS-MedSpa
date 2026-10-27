import { Role } from '@/generated/prisma/client';
import { enumDeLocale } from '@/lib/idiomas';
import { body, requireAuth, requireRole, route, t } from '@/server/http';
import { actualizar, anular, obtener } from '@/server/modules/invoices/invoices.service';
import { documentoSchema, fechaDesdeClave } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  return obtener(params.id);
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const datos = await body(req, documentoSchema);
  return actualizar(params.id, {
    ...datos,
    locale: datos.locale ? enumDeLocale(datos.locale) : undefined,
    issueDate: fechaDesdeClave(datos.issueDate),
  });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  await anular(params.id);
  return { message: t(req)('api.recibos.anuladoOk') };
});
