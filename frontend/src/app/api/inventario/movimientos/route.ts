import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role, StockMoveType } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import * as inventario from '@/server/modules/inventario/inventario.service';
import { HttpError } from '@/server/lib/httpError';
import { addDays, parseZonedDateTime, toZonedDateKey } from '@/server/lib/datetime';
import { body, query, requireAuth, requireRole, route } from '@/server/http';
import { movimientoSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  productId: z.string().optional(),
  lotId: z.string().optional(),
  patientId: z.string().optional(),
  type: z.enum(StockMoveType).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  take: z.coerce.number().int().min(1).max(300).default(100),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);
  const zona = env.CLINIC_TIMEZONE;
  return {
    items: await inventario.listarMovimientos({
      productId: q.productId,
      lotId: q.lotId,
      patientId: q.patientId,
      type: q.type,
      desde: q.desde ? parseZonedDateTime(q.desde, '00:00', zona) : undefined,
      hasta: q.hasta ? parseZonedDateTime(toZonedDateKey(addDays(parseZonedDateTime(q.hasta, '12:00', zona), 1), zona), '00:00', zona) : undefined,
      take: q.take,
    }),
  };
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, movimientoSchema);
  const zona = env.CLINIC_TIMEZONE;
  let occurredAt: Date;
  try {
    occurredAt = parseZonedDateTime(datos.fecha, datos.hora, zona);
  } catch {
    throw HttpError.badRequest('api.inventario.fechaInvalida');
  }
  const movimiento = await inventario.registrarMovimiento(
    {
      productId: datos.productId,
      type: datos.type,
      reason: datos.reason,
      quantity: datos.quantity,
      occurredAt,
      patientId: datos.patientId,
      lotNumber: datos.lotNumber,
      lotId: datos.lotId,
      expiresAt: datos.expiresAt ? parseZonedDateTime(datos.expiresAt, '12:00', zona) : null,
      unitCost: datos.unitCost,
      notes: datos.notes,
    },
    sesion.sub,
  );
  return NextResponse.json(movimiento, { status: 201 });
});

const correccionSchema = z.object({ id: z.string().min(1), motivo: z.string().trim().max(200).optional() });

/** Corregir un movimiento mal anotado: solo ADMIN. */
export const PATCH = route(async (req) => {
  const sesion = requireRole(req, Role.ADMIN);
  const datos = await body(req, correccionSchema);
  return NextResponse.json(await inventario.corregirMovimiento(datos.id, datos.motivo, sesion.sub), { status: 201 });
});
