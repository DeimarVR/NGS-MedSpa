import { NextResponse } from 'next/server';
import { body, query, requireAuth, route, t } from '@/server/http';
import { crear, listar } from '@/server/modules/clinical/clinical.service';
import { aEntrada, listadoSchema, mapaSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = route(async (req) => {
  requireAuth(req);
  return listar(query(req, listadoSchema));
});

export const POST = route(async (req) => {
  const usuario = requireAuth(req);
  const datos = await body(req, mapaSchema);
  const { ficha, avisos } = await crear(
    aEntrada(datos),
    usuario.sub,
  );
  const tr = t(req);
  return NextResponse.json({ ...ficha, avisos: avisos.map((a) => tr(a.clave, a.valores)) }, { status: 201 });
});
