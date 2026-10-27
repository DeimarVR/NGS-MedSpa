import { NextResponse } from 'next/server';
import { body, requireAuth, route, t } from '@/server/http';
import * as piel from '@/server/modules/facial/facial.service';
import { aEntrada, fichaPielSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const { ficha, avisos } = await piel.crear(aEntrada(await body(req, fichaPielSchema)), sesion.sub);
  const tr = t(req);
  return NextResponse.json({ ...ficha, avisos: avisos.map((a) => tr(a.clave, a.valores)) }, { status: 201 });
});
