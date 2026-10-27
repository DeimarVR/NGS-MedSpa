import { NextResponse } from 'next/server';
import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, requireRole, route } from '@/server/http';
import { servicioRapidoSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function aSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function slugLibre(base: string): Promise<string> {
  const raiz = base || 'tratamiento';
  for (let intento = 0; intento < 50; intento += 1) {
    const candidato = intento === 0 ? raiz : `${raiz}-${intento + 1}`;
    if (!(await prisma.service.findUnique({ where: { slug: candidato }, select: { id: true } }))) return candidato;
  }
  return `${raiz}-${Date.now()}`;
}

/**
 * Un tratamiento creado al vuelo sirve YA para agendar y cobrar, pero no sale
 * en la reserva en línea hasta que alguien le escriba la descripción.
 */
export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, servicioRapidoSchema);
  const servicio = await prisma.service.create({
    data: {
      name: datos.name,
      slug: await slugLibre(aSlug(datos.name)),
      durationMin: datos.durationMin,
      priceCents: datos.priceCents ?? null,
      category: datos.category,
      active: true,
      published: false,
    },
  });
  return NextResponse.json(servicio, { status: 201 });
});
