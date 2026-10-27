import { z } from 'zod';
import { Role } from '@/generated/prisma/client';
import {
  TAMANO_MAXIMO,
  TIPOS_PERMITIDOS,
  construirClave,
  esCarpetaValida,
  firmarSubida,
  rutaPublica,
  tipoAdmitido,
  type Carpeta,
} from '@/server/storage';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subidaSchema = z.object({
  carpeta: z.string().refine(esCarpetaValida, 'v.noPermitido'),
  contentType: z.enum(TIPOS_PERMITIDOS),
  size: z.coerce.number().int().positive(),
});

/**
 * URL firmada para que el navegador suba DIRECTO al bucket (esquiva el límite
 * de 4,5 MB de Vercel). El tamaño se controla aquí: meterlo en la firma hizo
 * que Railway rechazara todas las subidas en Dermocapilar.
 */
export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, subidaSchema);

  if (datos.carpeta === 'sitio') requireRole(req, Role.ADMIN);
  if (!tipoAdmitido(datos.carpeta as Carpeta, datos.contentType)) throw HttpError.unprocessable('api.archivos.tipoNoAdmitido');
  if (datos.size > TAMANO_MAXIMO) {
    throw HttpError.unprocessable('api.archivos.muyGrande', { mb: Math.round(TAMANO_MAXIMO / 1024 / 1024) });
  }

  const clave = construirClave(datos.carpeta as Carpeta, datos.contentType);
  return { urlDeSubida: await firmarSubida(clave, datos.contentType), clave, ruta: rutaPublica(clave) };
});
