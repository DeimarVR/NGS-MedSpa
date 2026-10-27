import { Role } from '@/generated/prisma/client';
import * as piel from '@/server/modules/facial/facial.service';
import { body, requireAuth, requireRole, route, t } from '@/server/http';
import { aEntrada, fichaPielSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  return piel.obtener(params.id);
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const sesion = requireAuth(req);
  const { ficha, avisos } = await piel.actualizar(params.id, aEntrada(await body(req, fichaPielSchema)), sesion.sub);
  const tr = t(req);
  return { ...ficha, avisos: avisos.map((a) => tr(a.clave, a.valores)) };
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  return piel.borrar(params.id);
});
