import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PaymentMethod, Role } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import * as caja from '@/server/modules/caja/caja.service';
import { HttpError } from '@/server/lib/httpError';
import { parseZonedDateTime } from '@/server/lib/datetime';
import { firmaPng } from '@/server/validaciones';
import { body, query, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pagoSchema = z.object({
  amount: z.coerce.number().int().positive('v.cantidadPositiva'),
  method: z.enum(PaymentMethod).default(PaymentMethod.TARJETA),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'v.elegirFecha'),
  hora: z.string().regex(/^\d{2}:\d{2}$/).default('12:00'),
  reference: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
  patientSignature: firmaPng.optional().nullable(),
  receivedSignature: firmaPng.optional().nullable(),
  receivedBy: z.string().trim().max(120).optional().nullable(),
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const sesion = requireAuth(req);
  const datos = await body(req, pagoSchema);
  let paidAt: Date;
  try {
    paidAt = parseZonedDateTime(datos.fecha, datos.hora, env.CLINIC_TIMEZONE);
  } catch {
    throw HttpError.badRequest('api.caja.fechaPagoInvalida');
  }
  const pago = await caja.registrarPago(
    params.id,
    {
      amount: datos.amount,
      method: datos.method,
      paidAt,
      reference: datos.reference,
      notes: datos.notes,
      patientSignature: datos.patientSignature,
      receivedSignature: datos.receivedSignature,
      receivedBy: datos.receivedBy,
    },
    sesion.sub,
  );
  return NextResponse.json(pago, { status: 201 });
});

const borradoSchema = z.object({ pagoId: z.string().min(1) });

export const DELETE = route<{ id: string }>(async (req) => {
  requireRole(req, Role.ADMIN);
  return caja.borrarPago(query(req, borradoSchema).pagoId);
});
