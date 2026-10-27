import { NextResponse } from 'next/server';
import { Role } from '@/generated/prisma/client';
import { env } from '@/server/config/env';
import { parseZonedDateTime } from '@/server/lib/datetime';
import * as inventario from '@/server/modules/inventario/inventario.service';
import { body, query, requireAuth, requireRole, route } from '@/server/http';
import { productoSchema } from './esquema';
import { consultaInventarioSchema } from './consulta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaInventarioSchema);
  const [items, porVencer, sinPrecio] = await Promise.all([inventario.listarInventario(q), inventario.lotesPorVencer(), inventario.productosSinPrecio()]);
  return { items, porVencer, sinPrecio };
});

export const POST = route(async (req) => {
  const sesion = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, productoSchema);
  const producto = await inventario.crearProducto(
    {
      ...datos,
      inicial: datos.inicial
        ? {
            cantidad: datos.inicial.cantidad,
            lotNumber: datos.inicial.lotNumber,
            unitCost: datos.inicial.unitCost,
            expiresAt: datos.inicial.expiresAt ? parseZonedDateTime(datos.inicial.expiresAt, '12:00', env.CLINIC_TIMEZONE) : null,
          }
        : null,
    },
    sesion.sub,
  );
  return NextResponse.json(producto, { status: 201 });
});
