import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { whereDeClienta } from '@/server/modules/patients/busqueda.service';
import { tokenDeEnlace } from '@/server/lib/tokens';
import { body, booleanoDeConsulta, query, requireAuth, route } from '@/server/http';
import { patientBodySchema } from './esquema';
import { datosDeClienta } from './datos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  active: booleanoDeConsulta.optional(),
  take: z.coerce.number().int().min(1).max(200).default(30),
  skip: z.coerce.number().int().min(0).default(0),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listQuerySchema);
  const where = {
    ...(q.active === undefined ? {} : { active: q.active }),
    ...(q.q ? whereDeClienta(q.q) : {}),
  };

  const [items, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        instagram: true,
        city: true,
        preferredLocale: true,
        active: true,
        updatedAt: true,
        publicToken: true,
        _count: { select: { appointments: true, records: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: q.take,
      skip: q.skip,
    }),
    prisma.patient.count({ where }),
  ]);

  return { items, total, take: q.take, skip: q.skip };
});

export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, patientBodySchema);
  const patient = await prisma.patient.create({
    data: { ...(datosDeClienta(datos) as { fullName: string; phone: string }), publicToken: tokenDeEnlace() },
  });
  return NextResponse.json(patient, { status: 201 });
});
