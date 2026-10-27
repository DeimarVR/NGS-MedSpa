import type { Locale } from '@/i18n/routing';
import { env } from './config/env';
import { leerAjustes } from './ajustes';
import { prisma } from './lib/prisma';
import { createLogger } from './lib/logger';
import { HORARIO_POR_DEFECTO } from './services/horario';
import { traducirServicio } from './modules/treatments/traduccion';

const log = createLogger('consultas');

/**
 * Lecturas públicas: las usan las páginas del sitio (directo, sin dar la
 * vuelta por HTTP) y las rutas /api/public.
 *
 * Si la base no responde, el sitio NO se cae: se muestran los datos por
 * defecto. Una landing en blanco por un corte de la base es peor que una con
 * el horario de siempre.
 */
export interface DatosClinica {
  nombre: string;
  direccion: string;
  telefono: string;
  telefonoEnlace: string;
  instagram: string;
  mapaUrl: string;
  mapaEmbed: string | null;
  avisoDemo: boolean;
  fotoEsencia: string | null;
  horario: Array<{ dia: number; abre: string; cierra: string } | { dia: number; cerrado: true }>;
}

export async function datosClinica(): Promise<DatosClinica> {
  const direccion = process.env.CLINIC_ADDRESS?.trim() || '';
  let ajustes = {
    telefono: '(214) 555-0100',
    instagram: 'ngsmedspa',
    mapaUrl: '',
    avisoDemo: '1',
    fotoEsencia: '',
  };
  let horario: DatosClinica['horario'] = HORARIO_POR_DEFECTO.map((h, dia) =>
    h ? { dia, abre: h.open, cierra: h.close } : { dia, cerrado: true as const },
  );

  try {
    const [leidos, horas] = await Promise.all([
      leerAjustes(['telefono', 'instagram', 'mapaUrl', 'avisoDemo', 'fotoEsencia'] as const),
      prisma.businessHour.findMany(),
    ]);
    ajustes = leidos;
    if (horas.length) {
      horario = [0, 1, 2, 3, 4, 5, 6].map((dia) => {
        const fila = horas.find((h) => h.dayOfWeek === dia && h.active);
        return fila ? { dia, abre: fila.openTime, cierra: fila.closeTime } : { dia, cerrado: true as const };
      });
    }
  } catch (fallo) {
    log.warn('la base no respondió: el sitio usa los datos por defecto', String(fallo).slice(0, 160));
  }

  const busqueda = encodeURIComponent(direccion || 'Dallas, TX');
  return {
    nombre: process.env.CLINIC_NAME || 'NGS MedSpa',
    direccion,
    telefono: ajustes.telefono,
    telefonoEnlace: `tel:+1${ajustes.telefono.replace(/\D/g, '').slice(-10)}`,
    instagram: ajustes.instagram.replace(/^@/, ''),
    mapaUrl: ajustes.mapaUrl || `https://www.google.com/maps/search/?api=1&query=${busqueda}`,
    // El mapa solo se incrusta con una dirección real; si no, queda la imagen de prueba.
    mapaEmbed: direccion ? `https://www.google.com/maps?q=${busqueda}&output=embed` : null,
    avisoDemo: ajustes.avisoDemo === '1',
    fotoEsencia: ajustes.fotoEsencia || null,
    horario,
  };
}

/** Tratamientos que salen en la reserva en línea, en el idioma pedido. */
export async function listServices(locale: Locale) {
  const filas = await prisma.service.findMany({
    // Doble candado: activo Y publicado.
    where: { active: true, published: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return filas.map((s) => traducirServicio(s, locale));
}

export async function getServiceBySlug(slug: string, locale: Locale) {
  const s = await prisma.service.findFirst({ where: { slug, active: true, published: true } });
  return s ? traducirServicio(s, locale) : null;
}

export function zonaHoraria(): string {
  return env.CLINIC_TIMEZONE;
}
