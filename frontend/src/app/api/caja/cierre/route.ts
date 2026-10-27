import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import * as caja from '@/server/modules/caja/caja.service';
import { body, query, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const { take } = query(req, z.object({ take: z.coerce.number().int().min(1).max(120).default(30) }));
  return { items: await caja.listarCierres(take) };
});

const cierreSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Centavos contados en el cajón. */
  countedCash: z.coerce.number().int().min(0),
  notes: z.string().trim().max(600).optional().nullable(),
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, cierreSchema);
  return NextResponse.json(await caja.cerrarDia(datos.fecha, datos.countedCash, datos.notes ?? null, sesion.sub), { status: 201 });
});

/** Reabrir un día cerrado: solo ADMIN. */
export const DELETE = route(async (req) => {
  requireRole(req, Role.ADMIN);
  return caja.reabrirDia(query(req, z.object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })).fecha);
});
