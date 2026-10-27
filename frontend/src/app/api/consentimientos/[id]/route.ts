import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { enumDeLocale } from '@/lib/idiomas';
import * as consentimientos from '@/server/modules/consentimientos/consentimientos.service';
import { body, booleanoDeConsulta, query, requireRole, route } from '@/server/http';
import { plantillaSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const datos = await body(req, plantillaSchema);
  return consentimientos.actualizarPlantilla(params.id, { ...datos, locale: enumDeLocale(datos.locale) });
});

/** Archivar (por defecto), reactivar (`?activa=true`) o borrar del todo (`?definitivo=true`). */
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const opciones = query(req, z.object({ definitivo: booleanoDeConsulta.optional(), activa: booleanoDeConsulta.optional() }));
  if (opciones.definitivo) return consentimientos.eliminarPlantilla(params.id);
  return consentimientos.archivarPlantilla(params.id, Boolean(opciones.activa));
});
