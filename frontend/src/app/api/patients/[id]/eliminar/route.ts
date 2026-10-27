import { Role } from '@/generated/prisma/client';
import { requireRole, route, t } from '@/server/http';
import { archivarClienta, borrarClienta, enPalabras, queTieneLaClienta } from '@/server/modules/patients/borrado.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Qué tiene la clienta: lo que decide si se puede borrar o solo archivar. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const estado = await queTieneLaClienta(params.id);
  return { ...estado, resumen: enPalabras(estado.tiene, t(req)) };
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const { nombre } = await borrarClienta(params.id, t(req));
  return { message: t(req)('api.clientas.borrada', { nombre }) };
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const { nombre } = await archivarClienta(params.id);
  return { message: t(req)('api.clientas.archivada', { nombre }) };
});
