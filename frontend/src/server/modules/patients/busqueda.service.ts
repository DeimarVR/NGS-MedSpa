import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { variantesDeAcento } from '@/server/lib/acentos';

/** `%` y `_` son comodines en LIKE: se escapan para buscarlos literalmente. */
export function escaparComodines(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

/**
 * Por nombre, palabra por palabra y sin importar las tildes: «rodriguez maria»
 * encuentra a «María Rodríguez».
 */
export function porNombreDeClienta(q: string): Prisma.PatientWhereInput {
  const palabras = q.split(/\s+/).filter((p) => p.length > 0);
  const deUna = (palabra: string): Prisma.PatientWhereInput => ({
    OR: variantesDeAcento(palabra).map((variante) => ({
      fullName: { contains: escaparComodines(variante), mode: 'insensitive' as const },
    })),
  });
  if (palabras.length <= 1) return deUna(q.trim() || q);
  return { AND: palabras.map(deUna) };
}

/** Busca por nombre, teléfono (solo dígitos), correo o Instagram. */
export function whereDeClienta(q: string): Prisma.PatientWhereInput {
  const literal = escaparComodines(q.trim());
  const digitos = q.replace(/\D/g, '');
  return {
    OR: [
      porNombreDeClienta(q),
      ...(digitos.length >= 3 ? [{ phone: { contains: digitos } }] : []),
      { email: { contains: literal, mode: 'insensitive' as const } },
      { instagram: { contains: literal.replace(/^@/, ''), mode: 'insensitive' as const } },
    ],
  };
}

export async function buscarFichas(q: string, cuantas = 6) {
  const texto = q.trim();
  if (texto.length < 2) return [];
  return prisma.patient.findMany({
    where: { AND: [{ active: true }, whereDeClienta(texto)] },
    select: { id: true, fullName: true, phone: true, email: true, active: true, preferredLocale: true, birthDate: true },
    orderBy: { updatedAt: 'desc' },
    take: cuantas,
  });
}
