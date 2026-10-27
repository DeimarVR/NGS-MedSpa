import { randomBytes } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError } from './lib/httpError';

/**
 * Almacenamiento de archivos en un bucket S3.
 *
 * El bucket es privado y así se queda: nada se sirve desde su dominio. Las
 * imágenes salen por `/api/archivos`, que comprueba quién pide qué antes de
 * entregar los bytes. Una foto clínica en una URL pública solo estaría
 * protegida porque nadie adivina la dirección, y eso no es protección.
 *
 * La subida sí va directa del navegador al bucket, con una URL firmada de
 * cinco minutos. Es lo que esquiva el límite de 4,5 MB por petición de las
 * funciones de Vercel, que una foto de celular se salta sin esfuerzo.
 */

/**
 * Carpetas del bucket. Todas privadas menos `sitio` (imágenes de la landing):
 * lo clínico solo se ve con sesión del panel, por `/api/archivos`.
 */
const CARPETAS = ['fotos', 'sesiones', 'mapas', 'sitio', 'consentimientos'] as const;
export type Carpeta = (typeof CARPETAS)[number];

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/** Una foto clínica tiene que ser imagen y un consentimiento, PDF. */
export const TIPOS_POR_CARPETA: Record<Carpeta, readonly string[]> = {
  fotos: TIPOS_IMAGEN,
  sesiones: TIPOS_IMAGEN,
  mapas: TIPOS_IMAGEN,
  sitio: TIPOS_IMAGEN,
  consentimientos: ['application/pdf'],
};

/** Los tipos que se pueden SUBIR desde el navegador, en alguna carpeta. */
export const TIPOS_PERMITIDOS = [...TIPOS_IMAGEN, 'application/pdf'] as const;

export function tipoAdmitido(carpeta: Carpeta, contentType: string): boolean {
  return TIPOS_POR_CARPETA[carpeta].includes(contentType);
}
export const TAMANO_MAXIMO = 15 * 1024 * 1024;

function config() {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  // Lección de Dermocapilar: si fallan a la vez las fotos viejas y las subidas
  // nuevas con «SignatureDoesNotMatch», son estas credenciales en Vercel, no el código.

  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw HttpError.serviceUnavailable('api.archivos.sinConfigurar');
  }

  return {
    bucket: S3_BUCKET,
    cliente: new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION ?? 'auto',
      // Los proveedores compatibles con S3 casi siempre esperan la ruta con el
      // bucket dentro de la URL, no como subdominio.
      forcePathStyle: true,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    }),
  };
}

/**
 * Nombre del objeto dentro del bucket.
 *
 * Lleva un aleatorio y descarta el nombre original salvo la extensión: el
 * nombre de archivo que llega del navegador es dato de entrada, y ha servido
 * para escaparse de la carpeta con un `../` más veces de las que debería.
 */
export function construirClave(carpeta: Carpeta, contentType: string): string {
  const extension =
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'application/pdf': 'pdf',
    }[contentType.split(';')[0].trim()] ?? 'bin';

  const fecha = new Date().toISOString().slice(0, 7); // AAAA-MM
  return `${carpeta}/${fecha}/${randomBytes(16).toString('hex')}.${extension}`;
}

export function esCarpetaValida(valor: string): valor is Carpeta {
  return (CARPETAS as readonly string[]).includes(valor);
}

/**
 * URL firmada para SUBIR. Vive cinco minutos.
 *
 * El tamaño NO va dentro de la firma. Se probó el 20/10 (meter `content-length`
 * entre las cabeceras firmadas) y el bucket de Railway rechazó TODAS las
 * subidas del panel con un 403 (22/10, «Cambiar imagen» en el sitio). El tope
 * se controla en `/api/uploads` con el tamaño que declara el navegador, y la
 * URL caduca a los cinco minutos.
 */
export async function firmarSubida(clave: string, contentType: string): Promise<string> {
  const { cliente, bucket } = config();
  return getSignedUrl(
    cliente,
    new PutObjectCommand({ Bucket: bucket, Key: clave, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

/**
 * El tipo que corresponde a la extensión de NUESTRAS claves (las pone
 * `construirClave` a partir de un tipo ya validado). Sirve para no tratar
 * como «binario» una foto que el bucket guardó sin tipo o con uno genérico.
 */
export function tipoPorExtension(clave: string): string | null {
  const extension = clave.split('.').pop()?.toLowerCase() ?? '';
  return (
    {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif',
      pdf: 'application/pdf',
    }[extension] ?? null
  );
}

/** Trae el objeto para servirlo desde nuestra ruta. */
/**
 * Una clave con forma de las nuestras: carpeta conocida, tramos sin puntos ni
 * barras raras, y una extensión. Lo demás no se le pregunta al bucket.
 */
const CLAVE_VALIDA = new RegExp(
  `^(${CARPETAS.join('|')})(/[A-Za-z0-9_-]+)*/[A-Za-z0-9_-]+\\.[a-z0-9]{2,5}$`,
);

export function esClaveValida(clave: string): boolean {
  return clave.length <= 200 && CLAVE_VALIDA.test(clave);
}

export async function leerObjeto(clave: string) {
  if (!esClaveValida(clave)) throw HttpError.notFound('api.archivos.noEncontrado');
  const { cliente, bucket } = config();
  let salida;
  try {
    salida = await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
  } catch (fallo) {
    /* Un archivo que no está es un 404, no un «error interno» de 500. */
    const f = fallo as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (f?.name === 'NoSuchKey' || f?.$metadata?.httpStatusCode === 404) {
      throw HttpError.notFound('api.archivos.noEncontrado');
    }
    throw fallo;
  }

  if (!salida.Body) throw HttpError.notFound('api.archivos.noEncontrado');

  return {
    cuerpo: salida.Body.transformToWebStream(),
    contentType: salida.ContentType ?? 'application/octet-stream',
    tamano: salida.ContentLength,
    etag: salida.ETag,
  };
}

/** Los bytes de un objeto (para pegar la foto del rostro en un PDF, por ejemplo). */
export async function leerBytes(clave: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (!esClaveValida(clave)) throw HttpError.notFound('api.archivos.noEncontrado');
  const { cliente, bucket } = config();
  const salida = await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
  if (!salida.Body) throw HttpError.notFound('api.archivos.noEncontrado');
  return {
    bytes: await salida.Body.transformToByteArray(),
    contentType: salida.ContentType ?? 'application/octet-stream',
  };
}

/**
 * Sube un archivo DESDE EL SERVIDOR.
 *
 * La subida normal la hace el navegador con una URL firmada, para esquivar el
 * límite de tamaño de las funciones. Pero el consentimiento firmado lo arma el
 * servidor —toma la plantilla, le pega la hoja de firma y produce un PDF
 * nuevo—, así que ese archivo nunca pasa por el navegador y necesita este
 * camino.
 */
export async function guardarObjeto(
  clave: string,
  cuerpo: Uint8Array,
  contentType: string,
): Promise<string> {
  const { cliente, bucket } = config();
  await cliente.send(
    new PutObjectCommand({ Bucket: bucket, Key: clave, Body: cuerpo, ContentType: contentType }),
  );
  return rutaPublica(clave);
}

export async function borrarObjeto(clave: string): Promise<void> {
  const { cliente, bucket } = config();
  await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
}

/** Ruta interna que se guarda en la base, nunca la URL del bucket. */
export function rutaPublica(clave: string): string {
  return `/api/archivos/${clave}`;
}

/** Camino inverso: de la ruta guardada a la clave del objeto. */
export function claveDesdeRuta(ruta: string): string | null {
  const prefijo = '/api/archivos/';
  return ruta.startsWith(prefijo) ? ruta.slice(prefijo.length) : null;
}

/**
 * Borra del bucket los archivos de unas rutas, SOLO si ya nadie los usa.
 *
 * Hasta ahora no se borraba nunca nada: al eliminar un registro de fotos, una
 * foto o una sesión, la imagen seguía en el almacenamiento y se podía abrir por
 * su dirección. Con datos clínicos eso hace imposible cumplir una solicitud de
 * borrado. Se comprueba antes que la ruta no siga apuntada en otro sitio (una
 * misma imagen puede estar en un registro y en una sesión). Nunca lanza: lo
 * importante —quitarla de la historia— ya se hizo.
 */
export async function borrarArchivosSinUso(rutas: Array<string | null | undefined>): Promise<void> {
  const unicas = [...new Set(rutas.filter((r): r is string => Boolean(r)))];
  if (!unicas.length) return;
  const { prisma } = await import('./lib/prisma');
  for (const ruta of unicas) {
    const clave = claveDesdeRuta(ruta);
    if (!clave) continue;
    try {
      const [enRegistros, enSesiones, enConsentimientos, enMapas] = await Promise.all([
        prisma.photoRecordItem.count({ where: { url: ruta } }),
        prisma.sessionPhoto.count({ where: { url: ruta } }),
        prisma.signedConsent.count({ where: { fileUrl: ruta } }),
        prisma.clinicalRecord.count({ where: { facePhotoUrl: ruta } }),
      ]);
      if (enRegistros + enSesiones + enConsentimientos + enMapas > 0) continue;
      await borrarObjeto(clave);
    } catch {
      // Sin almacenamiento configurado o el archivo ya no estaba: nada que hacer.
    }
  }
}
