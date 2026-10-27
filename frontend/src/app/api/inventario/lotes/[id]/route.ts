import { Role } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import { parseZonedDateTime } from '@/server/lib/datetime';
import * as inventario from '@/server/modules/inventario/inventario.service';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { loteSchema } from '../../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Trazabilidad: a quién se le aplicó este lote. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  return inventario.trazarLote(params.id);
});

/** Corregir datos del lote, o bloquearlo (retirado del mercado). */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, loteSchema);
  if (datos.blocked !== undefined) await inventario.bloquearLote(params.id, datos.blocked, datos.notes);
  return inventario.actualizarLote(params.id, {
    lotNumber: datos.lotNumber,
    ...(datos.expiresAt !== undefined ? { expiresAt: datos.expiresAt ? parseZonedDateTime(datos.expiresAt, '12:00', env.CLINIC_TIMEZONE) : null } : {}),
    ...(datos.unitCost !== undefined ? { unitCost: datos.unitCost } : {}),
    ...(datos.notes !== undefined ? { notes: datos.notes } : {}),
  });
});
