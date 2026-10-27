import { Role } from '@/generated/prisma/client';
import { body, requireAuth, requireRole, route, t } from '@/server/http';
import { actualizar, eliminar, obtener } from '@/server/modules/clinical/clinical.service';
import { aEntrada, mapaSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  return obtener(params.id);
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const usuario = requireAuth(req);
  const datos = await body(req, mapaSchema);
  const { ficha, avisos } = await actualizar(
    params.id,
    aEntrada(datos),
    usuario.sub,
  );
  const tr = t(req);
  return { ...ficha, avisos: avisos.map((a) => tr(a.clave, a.valores)) };
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const usuario = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  await eliminar(params.id, usuario.sub);
  return { message: t(req)('api.mapa.eliminado') };
});
