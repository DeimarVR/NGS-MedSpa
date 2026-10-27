import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, route, t } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cambioSchema = z.object({
  currentPassword: z.string().min(1, 'v.contrasenaObligatoria'),
  newPassword: z.string().min(8, 'v.contrasenaCorta').max(200),
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const { currentPassword, newPassword } = await body(req, cambioSchema);

  const user = await prisma.user.findUnique({ where: { id: sesion.sub } });
  if (!user) throw HttpError.unauthorized();

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw HttpError.badRequest('api.sesion.contrasenaActual');
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  return { message: t(req)('api.sesion.contrasenaCambiada') };
});
