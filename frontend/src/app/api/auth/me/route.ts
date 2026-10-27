import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { enumDeLocale, localeDeEnum } from '@/lib/idiomas';
import { firmaPng } from '@/server/validaciones';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELECCION = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  locale: true,
  credentials: true,
  lastLoginAt: true,
  signature: true,
} as const;

export const GET = route(async (req) => {
  const sesion = requireAuth(req);
  const user = await prisma.user.findUnique({ where: { id: sesion.sub }, select: { ...SELECCION, active: true } });
  if (!user || !user.active) throw HttpError.unauthorized('api.sesion.usuarioNoExiste');
  return { user: { ...user, locale: localeDeEnum(user.locale) } };
});

/**
 * Lo que cada quien cambia de su cuenta: nombre, credencial, idioma y firma.
 * El correo y el ROL no: el rol es el permiso, lo toca un administrador.
 */
const perfilSchema = z
  .object({
    fullName: z.string().trim().min(3, 'v.nombreCorto').max(120),
    credentials: z.string().trim().max(40).nullable(),
    locale: z.enum(['es', 'en', 'fr', 'ar', 'ja']),
    signature: firmaPng.nullable(),
  })
  .partial();

export const PUT = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, perfilSchema);

  const user = await prisma.user.update({
    where: { id: sesion.sub },
    data: {
      ...(datos.fullName !== undefined ? { fullName: datos.fullName } : {}),
      ...(datos.credentials !== undefined ? { credentials: datos.credentials || null } : {}),
      ...(datos.locale !== undefined ? { locale: enumDeLocale(datos.locale) } : {}),
      ...(datos.signature !== undefined ? { signature: datos.signature } : {}),
    },
    select: SELECCION,
  });

  return { user: { ...user, locale: localeDeEnum(user.locale) } };
});
