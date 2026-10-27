import { Role } from '@/generated/prisma/client';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { anular, convertirEnRecibo, marcarPagada, reabrir } from '@/server/modules/invoices/invoices.service';
import { estadoSchema } from '../../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { accion, method } = await body(req, estadoSchema);
  if (accion === 'anular') {
    requireRole(req, Role.ADMIN);
    return anular(params.id);
  }
  const sesion = requireAuth(req);
  if (accion === 'pagar') return marcarPagada(params.id, method, sesion.sub);
  if (accion === 'convertir') return convertirEnRecibo(params.id);
  return reabrir(params.id);
});
