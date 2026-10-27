import { NextResponse, type NextRequest } from 'next/server';
import { leerObjeto, tipoPorExtension, TIPOS_IMAGEN } from '@/server/storage';
import { fail, sesionParaArchivos } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lo que el navegador puede abrir en la pestaña. Lo demás se descarga. */
const SE_PUEDE_ABRIR = new Set<string>([...TIPOS_IMAGEN, 'application/pdf']);

/**
 * Sirve un archivo del bucket CON PERMISO.
 *
 * Las fotos clínicas y los consentimientos nunca son públicos: hace falta
 * sesión del panel (por cabecera o por la cookie que dejan el login para las
 * <img>). Solo `sitio/` (imágenes de la landing) es público.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ clave: string[] }> }): Promise<NextResponse> {
  try {
    const { clave: partes } = await ctx.params;
    const clave = partes.join('/');
    const publica = partes[0] === 'sitio';

    if (!publica && !sesionParaArchivos(req)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const objeto = await leerObjeto(clave);
    // Lección de Dermocapilar: un archivo guardado con tipo genérico se sirve
    // con el tipo de su extensión, o el navegador lo descarga en vez de mostrarlo.
    const guardado = (objeto.contentType ?? '').split(';')[0].trim().toLowerCase();
    const tipo = SE_PUEDE_ABRIR.has(guardado) ? guardado : (tipoPorExtension(clave) ?? guardado);
    const seAbre = SE_PUEDE_ABRIR.has(tipo);

    return new NextResponse(objeto.cuerpo as unknown as BodyInit, {
      headers: {
        'Content-Type': seAbre ? tipo : 'application/octet-stream',
        ...(seAbre ? {} : { 'Content-Disposition': 'attachment' }),
        'X-Content-Type-Options': 'nosniff',
        ...(objeto.tamano ? { 'Content-Length': String(objeto.tamano) } : {}),
        ...(objeto.etag ? { ETag: objeto.etag } : {}),
        'Cache-Control': publica ? 'public, max-age=31536000, immutable' : 'private, no-store, max-age=0',
      },
    });
  } catch (error) {
    return fail(error, req);
  }
}
