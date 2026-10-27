import { createTranslator } from 'next-intl';
import type { NextRequest } from 'next/server';
import es from '../../messages/es.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';
import ja from '../../messages/ja.json';
import { routing, type Locale } from '@/i18n/routing';
import { IDIOMAS, esLocale, localeDeEnum } from '@/lib/idiomas';
import type { Valores } from './lib/httpError';

/**
 * Traducción del lado del servidor: mensajes de error de la API, PDF y Excel.
 *
 * El panel manda su idioma en la cabecera `X-Idioma` (ver `lib/apiClient.ts`).
 * Si no llega, se mira `Accept-Language`, y si tampoco, inglés.
 */
const MENSAJES: Record<Locale, Record<string, unknown>> = { es, en, fr, ar, ja };

export function idiomaDe(req: NextRequest | Request): Locale {
  const pedido = req.headers.get('x-idioma');
  if (esLocale(pedido)) return pedido;
  const aceptados = req.headers.get('accept-language') ?? '';
  for (const parte of aceptados.split(',')) {
    const codigo = parte.trim().slice(0, 2).toLowerCase();
    if (esLocale(codigo)) return codigo;
  }
  return routing.defaultLocale;
}

/** Idioma a partir del enum guardado en la base (ficha de la clienta, recibo…). */
export function idiomaDeEnum(valor: string | null | undefined): Locale {
  return localeDeEnum(valor);
}

export type Traductor = (clave: string, valores?: Valores) => string;

const cache = new Map<Locale, Traductor>();

/**
 * Un traductor sin tipos estrictos: las claves de error se arman en tiempo de
 * ejecución. Si una clave no existe, devuelve la clave (y no revienta), para
 * que un error siempre llegue a la pantalla aunque falte su traducción.
 */
export function traductor(locale: Locale): Traductor {
  const previo = cache.get(locale);
  if (previo) return previo;

  const t = createTranslator({
    locale,
    messages: MENSAJES[locale],
    timeZone: process.env.CLINIC_TIMEZONE || 'America/Chicago',
    onError: () => {},
    getMessageFallback: ({ key, namespace }) => (namespace ? `${namespace}.${key}` : key),
  }) as unknown as ((clave: string, valores?: Valores) => string) & { has: (clave: string) => boolean };

  const traducir: Traductor = (clave, valores) => {
    if (!t.has(clave)) {
      // Se intenta en español, que es el idioma con todas las claves.
      if (locale !== 'es') return traductor('es')(clave, valores);
      return clave;
    }
    return t(clave, valores);
  };
  cache.set(locale, traducir);
  return traducir;
}

export function intlDe(locale: Locale): string {
  return IDIOMAS[locale].intl;
}
