import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { enumDeLocale, localeDeEnum } from '@/lib/idiomas';
import { body, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECCION_USUARIO = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  active: true,
  locale: true,
  credentials: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

/** Usuarios y roles: solo ADMIN. */
export const GET = route(async (req) => {
  requireRole(req, Role.ADMIN);
  const items = await prisma.user.findMany({ select: SELECCION_USUARIO, orderBy: [{ active: 'desc' }, { fullName: 'asc' }] });
  return { items: items.map((u) => ({ ...u, locale: localeDeEnum(u.locale) })) };
});

const crearSchema = z.object({
  email: z.email('v.correo').max(160),
  fullName: z.string().trim().min(3, 'v.nombreCorto').max(120),
  role: z.enum(Role),
  locale: z.enum(['es', 'en', 'fr', 'ar', 'ja']).default('en'),
  credentials: z.string().trim().max(40).optional(),
  password: z.string().min(8, 'v.contrasenaCorta').max(200),
});

export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN);
  const datos = await body(req, crearSchema);
  const email = datos.email.toLowerCase();

  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw HttpError.conflict('api.usuarios.correoUsado');
  }

  const user = await prisma.user.create({
    data: {
      email,
      fullName: datos.fullName,
      role: datos.role,
      locale: enumDeLocale(datos.locale),
      credentials: datos.credentials || null,
      passwordHash: await bcrypt.hash(datos.password, 10),
    },
    select: SELECCION_USUARIO,
  });
  return NextResponse.json({ user: { ...user, locale: localeDeEnum(user.locale) } }, { status: 201 });
});
