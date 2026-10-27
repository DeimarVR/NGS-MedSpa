import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { enumDeLocale } from '@/lib/idiomas';
import * as consentimientos from '@/server/modules/consentimientos/consentimientos.service';
import { body, booleanoDeConsulta, query, requireAuth, requireRole, route } from '@/server/http';
import { plantillaSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, z.object({ incluirInactivas: booleanoDeConsulta.optional() }));
  return { items: await consentimientos.listarPlantillas(q.incluirInactivas ?? false) };
});

export const POST = route(async (req) => {
  const sesion = requireRole(req, Role.ADMIN);
  const datos = await body(req, plantillaSchema);
  return NextResponse.json(await consentimientos.crearPlantilla({ ...datos, locale: enumDeLocale(datos.locale) }, sesion.sub), { status: 201 });
});
