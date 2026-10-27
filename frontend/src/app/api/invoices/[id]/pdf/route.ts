import { NextResponse, type NextRequest } from 'next/server';
import { HttpError } from '@/server/lib/httpError';
import { fail, sesionParaArchivos } from '@/server/http';
import { obtener } from '@/server/modules/invoices/invoices.service';
import { pdfDeDocumento } from '@/server/modules/invoices/documento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El PDF del recibo o la cotización. Acepta la sesión por cabecera o por la
 * cookie del login, para poder abrirlo en una pestaña nueva.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    if (!sesionParaArchivos(req)) throw HttpError.unauthorized();
    const { id } = await ctx.params;
    const documento = await obtener(id);
    const pdf = await pdfDeDocumento(documento);
    const nombre = `${documento.series}-${String(documento.number).padStart(5, '0')}.pdf`;
    const descargar = req.nextUrl.searchParams.get('descargar') === '1';
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${nombre}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return fail(error, req);
  }
}
