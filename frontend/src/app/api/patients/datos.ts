import { enumDeLocale } from '@/lib/idiomas';
import { normalizePhone } from '@/server/lib/phone';
import type { z } from 'zod';
import type { patientUpdateSchema } from './esquema';

/** De lo que llega del formulario a lo que se guarda (solo las claves que llegaron). */
export function datosDeClienta(datos: z.infer<typeof patientUpdateSchema>) {
  const { preferredLocale, birthDate, phone, email, instagram, ...resto } = datos;
  return {
    ...resto,
    ...(phone !== undefined ? { phone: normalizePhone(phone) } : {}),
    ...(email !== undefined ? { email: email ? email.toLowerCase() : null } : {}),
    ...(instagram !== undefined ? { instagram: instagram ? instagram.replace(/^@/, '').trim() : null } : {}),
    ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(`${birthDate}T00:00:00.000Z`) : null } : {}),
    ...(preferredLocale !== undefined ? { preferredLocale: enumDeLocale(preferredLocale) } : {}),
  };
}
