import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import { AJUSTES, guardarAjuste, leerTodos, type NombreAjuste } from '@/server/ajustes';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ajustes del panel (lista cerrada, ver `server/ajustes.ts`). */
export const GET = route(async (req) => {
  requireAuth(req);
  return leerTodos();
});

const rutaDeSitio = z
  .string()
  .trim()
  .refine((v) => v === '' || v.startsWith('/api/archivos/sitio/'), 'v.imagenDelPanel');

const ajustesSchema = z
  .object({
    telefono: z.string().trim().min(7, 'v.telefono').max(30),
    instagram: z
      .string()
      .trim()
      .max(40)
      .transform((v) => v.replace(/^@/, ''))
      .refine((v) => /^[A-Za-z0-9._]*$/.test(v), 'v.instagram'),
    mapaUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(v), 'v.mapa'),
    facebook: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === '' || /^https:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.com)\/\S+$/i.test(v), 'v.facebook'),
    tiktok: z
      .string()
      .trim()
      .max(200)
      .refine((v) => v === '' || /^https:\/\/(www\.)?tiktok\.com\/@\S+$/i.test(v), 'v.tiktok'),
    fotoEsencia: rutaDeSitio,
    cupos: z.string().regex(/^([1-9]|10)$/, 'v.cupos'),
    impuestoBps: z.string().regex(/^\d{1,4}$/, 'v.impuesto'),
    notaRecibo: z.string().trim().max(500),
  } satisfies Record<NombreAjuste, z.ZodType>)
  .partial();

export const PUT = route(async (req) => {
  requireRole(req, Role.ADMIN);
  const datos = await body(req, ajustesSchema);
  for (const nombre of Object.keys(datos) as NombreAjuste[]) {
    if (!(nombre in AJUSTES)) continue;
    const valor = datos[nombre];
    if (valor !== undefined) await guardarAjuste(nombre, String(valor));
  }
  revalidatePath('/', 'layout');
  return leerTodos();
});
