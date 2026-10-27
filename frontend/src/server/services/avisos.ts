import { AppointmentStatus } from '@/generated/prisma/client';
import type { Locale } from '@/i18n/routing';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { toZonedDateKey } from '../lib/datetime';
import { intlDe, traductor, type Traductor } from '../i18n';
import * as inventario from '../modules/inventario/inventario.service';
import { calcularRetoques } from '../modules/retoques/retoques.service';

/**
 * La campana del panel: lo que hay que mirar hoy y qué parte ya se vio.
 *
 * Los avisos son ESTADOS («3 productos en el mínimo»), no mensajes: lo que se
 * guarda por usuario es QUÉ cosas concretas se vieron (`agotado:prod_x`), y el
 * número de la campana solo cuenta lo que no está en esa lista. Si mañana se
 * agota otro producto, aparece él solo; si uno se repone, se olvida, y si
 * vuelve a agotarse avisa otra vez. (Lección de Dermocapilar.)
 *
 * Sin WhatsApp ni bot, la agenda también se vigila aquí: citas por confirmar,
 * cancelaciones, mensajes de la web y retoques que tocan.
 */
export type Gravedad = 'alta' | 'media';

/** Una cita sin confirmar de las próximas 48 h hay que perseguirla HOY. */
const HORAS_INMINENTE = 48;
/** Una cancelación es noticia (un hueco que llenar) durante dos días. */
const HORAS_CANCELACION = 48;
const HORA_EN_MS = 60 * 60 * 1000;

export interface Aviso {
  id: string;
  gravedad: Gravedad;
  titulo: string;
  detalle: string;
  /** Dónde se arregla (sin el prefijo de idioma). */
  href: string;
  claves: string[];
  nuevos: number;
}

export interface Avisos {
  items: Aviso[];
  sinLeer: number;
  total: number;
}

const clave = (usuarioId: string) => `avisos_vistos:${usuarioId}`;

async function loQueYaVio(usuarioId: string): Promise<Set<string>> {
  const fila = await prisma.setting.findUnique({ where: { key: clave(usuarioId) } });
  if (!fila?.value) return new Set();
  try {
    const lista = JSON.parse(fila.value) as unknown;
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** «hoy 3:00 p. m.», «mañana 10:30 a. m.», «mié 22 oct 9:00 a. m.». */
function cuandoCorto(fecha: Date, ahora: Date, t: Traductor, intl: string): string {
  const zona = env.CLINIC_TIMEZONE;
  const hora = new Intl.DateTimeFormat(intl, { timeZone: zona, hour: 'numeric', minute: '2-digit' }).format(fecha);
  const dia = toZonedDateKey(fecha, zona);
  if (dia === toZonedDateKey(ahora, zona)) return t('avisos.hoy', { hora });
  if (dia === toZonedDateKey(new Date(ahora.getTime() + 24 * HORA_EN_MS), zona)) return t('avisos.manana', { hora });
  return new Intl.DateTimeFormat(intl, { timeZone: zona, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(fecha);
}

/** «Botox, Juvéderm y 3 más»: con sesenta nombres no se lee ninguno. */
function nombres(lista: string[], t: Traductor, intl: string, tope = 3): string {
  const lf = new Intl.ListFormat(intl, { style: 'long', type: 'conjunction' });
  if (lista.length <= tope) return lf.format(lista);
  return t('avisos.yMas', { lista: lista.slice(0, tope).join(', '), n: lista.length - tope });
}

export async function avisosDe(usuarioId: string, locale: Locale): Promise<Avisos> {
  const t = traductor(locale);
  const intl = intlDe(locale);
  const ahora = new Date();
  const limiteInminente = new Date(ahora.getTime() + HORAS_INMINENTE * HORA_EN_MS);
  const desdeCancelacion = new Date(ahora.getTime() - HORAS_CANCELACION * HORA_EN_MS);

  const [productos, lotes, sinConfirmar, canceladas, mensajes, retoques, vistos] = await Promise.all([
    inventario.listarInventario(),
    inventario.lotesPorVencer(),
    // Solo las que están POR VENIR: una pendiente que ya pasó se cierra en Citas.
    prisma.appointment.findMany({
      where: { status: AppointmentStatus.PENDIENTE, startsAt: { gte: ahora } },
      select: { id: true, contactName: true, startsAt: true },
      orderBy: { startsAt: 'asc' },
      take: 50,
    }),
    prisma.appointment.findMany({
      where: { status: AppointmentStatus.CANCELADA, cancelledAt: { gte: desdeCancelacion }, startsAt: { gte: ahora } },
      select: { id: true, contactName: true, startsAt: true },
      orderBy: { cancelledAt: 'desc' },
      take: 50,
    }),
    prisma.contactMessage.findMany({
      where: { handled: false },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    calcularRetoques({ locale }).catch(() => []),
    loQueYaVio(usuarioId),
  ]);

  const items: Aviso[] = [];
  function agregar(id: string, gravedad: Gravedad, prefijo: string, cosas: Array<{ id: string; texto: string }>, href: string, tope = 3) {
    if (cosas.length === 0) return;
    const claves = cosas.map((c) => `${prefijo}:${c.id}`);
    items.push({
      id,
      gravedad,
      titulo: t(`avisos.titulos.${id}`, { n: cosas.length }),
      detalle: nombres(
        cosas.map((c) => c.texto),
        t,
        intl,
        tope,
      ),
      href,
      claves,
      nuevos: claves.filter((c) => !vistos.has(c)).length,
    });
  }

  const conStock = productos.filter((p) => p.active);
  // El orden es el de la urgencia real: lo que frena una atención hoy, primero.
  agregar(
    'agotados',
    'alta',
    'agotado',
    conStock.filter((p) => p.stock === 0).map((p) => ({ id: p.id, texto: p.name })),
    '/admin/inventario',
  );
  agregar(
    'vencidos',
    'alta',
    'vencido',
    conStock.flatMap((p) => p.lotes.filter((l) => l.vencido && l.stock > 0).map((l) => ({ id: l.id, texto: `${p.name} · ${l.lotNumber}` }))),
    '/admin/inventario',
  );
  agregar(
    'sinConfirmarYa',
    'alta',
    'cita-ya',
    sinConfirmar.filter((c) => c.startsAt <= limiteInminente).map((c) => ({ id: c.id, texto: `${c.contactName} · ${cuandoCorto(c.startsAt, ahora, t, intl)}` })),
    '/admin/citas?estado=PENDIENTE',
    2,
  );
  agregar(
    'mensajesWeb',
    'media',
    'mensaje',
    mensajes.map((m) => ({ id: m.id, texto: m.name })),
    '/admin/mensajes',
  );
  agregar(
    'sinConfirmar',
    'media',
    'cita-pendiente',
    sinConfirmar.filter((c) => c.startsAt > limiteInminente).map((c) => ({ id: c.id, texto: `${c.contactName} · ${cuandoCorto(c.startsAt, ahora, t, intl)}` })),
    '/admin/citas?estado=PENDIENTE',
    2,
  );
  agregar(
    'canceladas',
    'media',
    'cita-cancelada',
    canceladas.map((c) => ({ id: c.id, texto: `${c.contactName} · ${cuandoCorto(c.startsAt, ahora, t, intl)}` })),
    '/admin/citas?estado=CANCELADA',
    2,
  );
  agregar(
    'retoques',
    'media',
    'retoque',
    retoques.map((r) => ({ id: r.clave, texto: `${r.patientName} · ${r.serviceName}` })),
    '/admin#retoques',
    2,
  );
  agregar(
    'bajos',
    'media',
    'bajo',
    conStock.filter((p) => p.bajo && p.stock > 0).map((p) => ({ id: p.id, texto: `${p.name} (${p.stock})` })),
    '/admin/inventario',
  );
  agregar(
    'porVencer',
    'media',
    'porvencer',
    lotes.filter((l) => l.expiresAt && l.expiresAt > ahora).map((l) => ({ id: l.id, texto: `${l.product.name} · ${l.lotNumber}` })),
    '/admin/inventario',
  );
  agregar(
    'negativos',
    'media',
    'negativo',
    conStock.filter((p) => p.stock < 0).map((p) => ({ id: p.id, texto: `${p.name} (${p.stock})` })),
    '/admin/inventario',
  );

  // Se olvida lo que ya no está pasando, para que vuelva a avisar si se repite.
  const presentes = new Set(items.flatMap((aviso) => aviso.claves));
  if ([...vistos].some((c) => !presentes.has(c))) {
    const limpio = [...vistos].filter((c) => presentes.has(c));
    await prisma.setting.upsert({
      where: { key: clave(usuarioId) },
      create: { key: clave(usuarioId), value: JSON.stringify(limpio) },
      update: { value: JSON.stringify(limpio) },
    });
  }

  return {
    items,
    sinLeer: items.reduce((suma, aviso) => suma + aviso.nuevos, 0),
    total: items.reduce((suma, aviso) => suma + aviso.claves.length, 0),
  };
}

/** Marca como visto. Sin `claves`, todo lo que hay ahora mismo. */
export async function marcarVistos(usuarioId: string, locale: Locale, claves?: string[]): Promise<Avisos> {
  const actuales = await avisosDe(usuarioId, locale);
  const todas = actuales.items.flatMap((aviso) => aviso.claves);
  const aGuardar = claves?.length ? [...new Set([...(await loQueYaVio(usuarioId)), ...claves])].filter((c) => todas.includes(c)) : todas;
  await prisma.setting.upsert({
    where: { key: clave(usuarioId) },
    create: { key: clave(usuarioId), value: JSON.stringify(aGuardar) },
    update: { value: JSON.stringify(aGuardar) },
  });
  return avisosDe(usuarioId, locale);
}
