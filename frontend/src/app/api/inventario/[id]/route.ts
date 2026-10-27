import { Role } from '@/generated/prisma/client';
import * as inventario from '@/server/modules/inventario/inventario.service';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { productoSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Los lotes con existencia del producto (FEFO), para elegir al aplicar o sacar. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  return { lotes: await inventario.lotesDisponibles(params.id) };
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const { inicial: _ignorado, ...datos } = await body(req, productoSchema);
  return inventario.actualizarProducto(params.id, datos);
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const sesion = requireRole(req, Role.ADMIN);
  return inventario.archivarProducto(params.id, sesion.sub);
});
