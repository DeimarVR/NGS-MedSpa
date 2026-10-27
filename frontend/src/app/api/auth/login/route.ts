import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { localeDeEnum } from '@/lib/idiomas';
import { LIMITES, body, limitar, route, signToken } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.email('v.correo'),
  password: z.string().min(1, 'v.contrasenaObligatoria'),
});

/** Hash de relleno: se compara aunque el usuario no exista, para no delatar qué correos hay. */
const HASH_DE_RELLENO = '$2b$10$OV6F53RKWAxwzCpD1dEGpOeZ/NckQCEE10UOS48qwX91qHWG30Ov.';

export const POST = route(async (req) => {
  limitar(req, 'login', LIMITES.login);
  const { email, password } = await body(req, loginSchema);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const valido = await bcrypt.compare(password, user?.passwordHash ?? HASH_DE_RELLENO);

  if (!user || !valido || !user.active) throw HttpError.unauthorized('api.sesion.credenciales');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signToken({ sub: user.id, email: user.email, role: user.role, fullName: user.fullName });

  const respuesta = NextResponse.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, locale: localeDeEnum(user.locale) },
  });

  // Además del token del navegador, una cookie httpOnly: sirve SOLO para que
  // las <img> del panel puedan pedir las fotos protegidas.
  respuesta.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });

  return respuesta;
});
