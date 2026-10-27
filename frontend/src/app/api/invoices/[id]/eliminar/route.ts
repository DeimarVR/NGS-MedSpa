import { Role } from '@/generated/prisma/client';
import { requireAuth, requireRole, route, t } from '@/server/http';
import { borrarRecibo, queTieneElRecibo } from '@/server/modules/invoices/borrado.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  return queTieneElRecibo(params.id);
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const { numero, numeroReutilizable } = await borrarRecibo(params.id);
  return {
    message: t(req)(numeroReutilizable ? 'api.recibos.borradoReutiliza' : 'api.recibos.borrado', { numero }),
    numeroReutilizable,
  };
});
