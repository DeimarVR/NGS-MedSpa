import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Borra la cookie de las fotos. El token del navegador se borra en el cliente,
 * pero la cookie seguía viva 8 horas: en un equipo compartido, otra persona
 * podía abrir desde el historial las fotos clínicas.
 */
export function POST(): NextResponse {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return respuesta;
}
