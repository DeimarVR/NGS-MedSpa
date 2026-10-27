import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { enumDeLocale, localeDeEnum } from '@/lib/idiomas';
import { body, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const editarSchema = z
  .object({
    fullName: z.string().trim().min(3, 'v.nombreCorto').max(120),
    role: z.enum(Role),
    active: z.boolean(),
    locale: z.enum(['es', 'en', 'fr', 'ar', 'ja']),
    credentials: z.string().trim().max(40).nullable(),
    /** Contraseña nueva puesta por el administrador (la persona la cambia después). */
    password: z.string().min(8, 'v.contrasenaCorta').max(200),
  })
  .partial();

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const sesion = requireRole(req, Role.ADMIN);
  const datos = await body(req, editarSchema);

  const actual = await prisma.user.findUnique({ where: { id: params.id } });
  if (!actual) throw HttpError.notFound('api.usuarios.noEncontrado');

  // Nadie se quita a sí mismo el acceso de administrador ni se desactiva:
  // así es como un panel se queda sin nadie que lo pueda administrar.
  if (params.id === sesion.sub && ((datos.role && datos.role !== Role.ADMIN) || datos.active === false)) {
    throw HttpError.unprocessable('api.usuarios.noASiMismo');
  }

  // Y siempre tiene que quedar al menos un administrador activo.
  const dejaDeSerAdmin =
    actual.role === Role.ADMIN && actual.active && ((datos.role && datos.role !== Role.ADMIN) || datos.active === false);
  if (dejaDeSerAdmin) {
    const otros = await prisma.user.count({ where: { role: Role.ADMIN, active: true, id: { not: actual.id } } });
    if (otros === 0) throw HttpError.unprocessable('api.usuarios.ultimoAdmin');
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(datos.fullName !== undefined ? { fullName: datos.fullName } : {}),
      ...(datos.role !== undefined ? { role: datos.role } : {}),
      ...(datos.active !== undefined ? { active: datos.active } : {}),
      ...(datos.locale !== undefined ? { locale: enumDeLocale(datos.locale) } : {}),
      ...(datos.credentials !== undefined ? { credentials: datos.credentials || null } : {}),
      ...(datos.password ? { passwordHash: await bcrypt.hash(datos.password, 10) } : {}),
    },
    select: { id: true, email: true, fullName: true, role: true, active: true, locale: true, credentials: true, lastLoginAt: true, createdAt: true },
  });
  return { user: { ...user, locale: localeDeEnum(user.locale) } };
});
