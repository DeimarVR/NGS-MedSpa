import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AppointmentSource,
  AppointmentStatus,
  Idioma,
  PrismaClient,
  ProductKind,
  StockMoveReason,
  StockMoveType,
  type ServiceCategory,
} from '../src/generated/prisma/client';
import { addDays, parseZonedDateTime, toZonedDateKey } from '../src/server/lib/datetime';
import { HORARIO_POR_DEFECTO } from '../src/server/services/horario';
import { SERVICIOS } from './datos/servicios';
import { CONSENTIMIENTOS } from './datos/consentimientos';

/**
 * Datos iniciales: catálogo de tratamientos, horario y consentimientos de
 * ejemplo. NO crea usuarios (eso es `npm run crear-admin`).
 *
 *   npm run seed            → catálogo, horario y consentimientos
 *   npm run seed -- --demo  → además, productos, clientas y citas DE PRUEBA
 *                             (solo para enseñar el panel; no en producción)
 *
 * Es idempotente: lo que ya existe no se toca (ni se pisan los cambios que la
 * clínica haya hecho desde el panel).
 */
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en el .env');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const ZONA = process.env.CLINIC_TIMEZONE || 'America/Chicago';
const DEMO = process.argv.includes('--demo');
const token = () => randomBytes(24).toString('base64url');

async function servicios() {
  let nuevos = 0;
  for (const [indice, s] of SERVICIOS.entries()) {
    const existe = await prisma.service.findUnique({ where: { slug: s.slug }, select: { id: true } });
    if (existe) continue;
    await prisma.service.create({
      data: {
        slug: s.slug,
        name: s.es.name,
        shortDesc: s.es.shortDesc,
        category: s.category as ServiceCategory,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
        priceMode: s.priceMode,
        touchUpDays: s.touchUpDays,
        icon: s.icon,
        featured: s.featured ?? false,
        published: s.published ?? true,
        sortOrder: (indice + 1) * 10,
        translations: { en: s.en, fr: s.fr, ar: s.ar, ja: s.ja },
      },
    });
    nuevos += 1;
  }
  console.log(`Tratamientos: ${nuevos} nuevos (${SERVICIOS.length - nuevos} ya estaban)`);
}

async function horario() {
  if ((await prisma.businessHour.count()) > 0) {
    console.log('Horario: ya estaba');
    return;
  }
  await prisma.businessHour.createMany({
    data: HORARIO_POR_DEFECTO.map((h, dia) => ({
      dayOfWeek: dia,
      active: Boolean(h),
      openTime: h?.open ?? '10:00',
      closeTime: h?.close ?? '19:00',
    })),
  });
  console.log('Horario: martes a viernes 10:00–19:00, sábado 9:00–16:00');
}

async function consentimientos() {
  let nuevos = 0;
  for (const c of CONSENTIMIENTOS) {
    const existe = await prisma.consentTemplate.findFirst({ where: { name: c.name, locale: c.locale as Idioma }, select: { id: true } });
    if (existe) continue;
    const ligados = await prisma.service.findMany({ where: { slug: { in: c.servicios } }, select: { id: true } });
    await prisma.consentTemplate.create({
      data: {
        name: c.name,
        description: c.description,
        kind: c.kind,
        locale: c.locale as Idioma,
        body: c.body,
        services: { connect: ligados },
      },
    });
    nuevos += 1;
  }
  console.log(`Consentimientos de ejemplo: ${nuevos} nuevos`);
}

/* ------------------------------------------------------------------------ */
/* Datos de prueba (--demo)                                                  */
/* ------------------------------------------------------------------------ */

const PRODUCTOS = [
  { name: 'Botox 100 U', kind: ProductKind.TOXINA, brand: 'Allergan', unit: 'vial', applicationUnit: 'U', applicationPerUnit: 100, minStock: 2, lote: 'BTX-24A', cantidad: 6, meses: 10, costo: 42000 },
  { name: 'Dysport 300 U', kind: ProductKind.TOXINA, brand: 'Galderma', unit: 'vial', applicationUnit: 'U', applicationPerUnit: 300, minStock: 1, lote: 'DYS-311', cantidad: 3, meses: 8, costo: 52000 },
  { name: 'Juvéderm Volbella 1 ml', kind: ProductKind.RELLENO, brand: 'Allergan', unit: 'jeringa', applicationUnit: 'ml', applicationPerUnit: 1, minStock: 3, lote: 'VB-2207', cantidad: 8, meses: 6, costo: 26000 },
  { name: 'Restylane Kysse 1 ml', kind: ProductKind.RELLENO, brand: 'Galderma', unit: 'jeringa', applicationUnit: 'ml', applicationPerUnit: 1, minStock: 3, lote: 'RK-9134', cantidad: 1, meses: 1.3, costo: 27000 },
  { name: 'Sculptra', kind: ProductKind.BIOESTIMULADOR, brand: 'Galderma', unit: 'vial', applicationUnit: 'vial', applicationPerUnit: 1, minStock: 2, lote: 'SC-5501', cantidad: 4, meses: 14, costo: 40000 },
  { name: 'Profhilo 2 ml', kind: ProductKind.SKIN_BOOSTER, brand: 'IBSA', unit: 'jeringa', applicationUnit: 'ml', applicationPerUnit: 2, minStock: 2, lote: 'PF-881', cantidad: 5, meses: 9, costo: 23000 },
  { name: 'Crema anestésica 30 g', kind: ProductKind.INSUMO, brand: null, unit: 'tubo', applicationUnit: 'g', applicationPerUnit: 30, minStock: 2, lote: null, cantidad: 3, meses: null, costo: 2500 },
  { name: 'Protector solar SPF 50', kind: ProductKind.VENTA, brand: null, unit: 'unidad', applicationUnit: 'unidad', applicationPerUnit: 1, minStock: 4, lote: null, cantidad: 12, meses: null, costo: 1800, venta: 4500 },
];

async function demo() {
  if ((await prisma.product.count()) === 0) {
    for (const p of PRODUCTOS) {
      const producto = await prisma.product.create({
        data: {
          name: p.name,
          kind: p.kind,
          brand: p.brand,
          unit: p.unit,
          applicationUnit: p.applicationUnit,
          applicationPerUnit: p.applicationPerUnit,
          minStock: p.minStock,
          salePrice: 'venta' in p ? p.venta : null,
        },
      });
      const lote = p.lote
        ? await prisma.lot.create({
            data: { productId: producto.id, lotNumber: p.lote, expiresAt: p.meses ? addDays(new Date(), Math.round(p.meses * 30)) : null, unitCost: p.costo },
          })
        : null;
      await prisma.stockMove.create({
        data: {
          productId: producto.id,
          lotId: lote?.id ?? null,
          type: StockMoveType.ENTRADA,
          reason: StockMoveReason.COMPRA,
          quantity: p.cantidad,
          occurredAt: new Date(),
          unitCost: p.costo,
          notes: 'Datos de prueba',
        },
      });
    }
    console.log(`Productos de prueba: ${PRODUCTOS.length}`);
  }

  if ((await prisma.patient.count()) > 0) {
    console.log('Clientas: ya había, no se agregan de prueba');
    return;
  }
  const clientas = await Promise.all(
    [
      { fullName: 'María Fernanda López', phone: '12145550111', email: 'maria.demo@example.com', preferredLocale: Idioma.ES },
      { fullName: 'Ashley Johnson', phone: '14695550122', email: 'ashley.demo@example.com', preferredLocale: Idioma.EN },
      { fullName: 'Camille Tremblay', phone: '18175550133', email: null, preferredLocale: Idioma.FR },
    ].map((c) => prisma.patient.create({ data: { ...c, publicToken: token() } })),
  );

  const porSlug = new Map((await prisma.service.findMany({ select: { id: true, slug: true, durationMin: true } })).map((s) => [s.slug, s]));
  const hoy = toZonedDateKey(new Date(), ZONA);
  /** El próximo día abierto a partir de `desde` (martes a sábado). */
  const abierto = (desde: number) => {
    for (let i = desde; i < desde + 7; i += 1) {
      const clave = toZonedDateKey(addDays(parseZonedDateTime(hoy, '12:00', ZONA), i), ZONA);
      const dia = new Date(`${clave}T12:00:00Z`).getUTCDay();
      if (HORARIO_POR_DEFECTO[dia]) return clave;
    }
    return hoy;
  };
  const citas: Array<[number, string, string, (typeof clientas)[number], AppointmentStatus]> = [
    [0, '11:00', 'toxina-botulinica', clientas[0], AppointmentStatus.CONFIRMADA],
    [0, '15:30', 'valoracion', clientas[1], AppointmentStatus.PENDIENTE],
    [1, '10:30', 'relleno-labios', clientas[2], AppointmentStatus.PENDIENTE],
    [3, '13:00', 'skin-boosters', clientas[0], AppointmentStatus.CONFIRMADA],
  ];
  for (const [dias, hora, slug, clienta, status] of citas) {
    const servicio = porSlug.get(slug);
    if (!servicio) continue;
    const startsAt = parseZonedDateTime(abierto(dias), hora, ZONA);
    await prisma.appointment.create({
      data: {
        serviceId: servicio.id,
        patientId: clienta.id,
        contactName: clienta.fullName,
        contactPhone: clienta.phone,
        contactEmail: clienta.email,
        locale: clienta.preferredLocale,
        startsAt,
        endsAt: new Date(startsAt.getTime() + servicio.durationMin * 60_000),
        status,
        source: AppointmentSource.WEB,
        manageToken: token(),
      },
    });
  }
  console.log(`Clientas y citas de prueba: ${clientas.length} y ${citas.length}`);
}

async function main() {
  await servicios();
  await horario();
  await consentimientos();
  if (DEMO) await demo();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
