import { NextResponse } from 'next/server';
import { enumDeLocale } from '@/lib/idiomas';
import { body, query, requireAuth, route } from '@/server/http';
import * as caja from '@/server/modules/caja/caja.service';
import { crear, listar } from '@/server/modules/invoices/invoices.service';
import { documentoSchema, fechaDesdeClave, listadoSchema } from './esquema';
import { rangoDelListado } from './periodo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listadoSchema);
  const { fecha, rango, desde, hasta } = rangoDelListado(q);

  const [listado, resumen, abonosDeOtroDia] = await Promise.all([
    listar({ q: q.q, type: q.type, status: q.status, patientId: q.patientId, desde, hasta, take: q.take, skip: q.skip }),
    caja.resumenCaja(rango.desde, rango.hasta),
    caja.abonosDeOtrosDias(rango.desde, rango.hasta),
  ]);

  return { ...listado, periodo: q.periodo, fecha, resumen, abonosDeOtroDia };
});

export const POST = route(async (req) => {
  const usuario = requireAuth(req);
  const datos = await body(req, documentoSchema);
  const documento = await crear(
    { ...datos, locale: datos.locale ? enumDeLocale(datos.locale) : undefined, issueDate: fechaDesdeClave(datos.issueDate) },
    usuario.sub,
  );
  return NextResponse.json(documento, { status: 201 });
});
