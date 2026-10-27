import type { Service } from '@/generated/prisma/client';
import type { Locale } from '@/i18n/routing';

/** Campos de un tratamiento que se traducen. */
export const CAMPOS_TRADUCIBLES = ['name', 'shortDesc', 'description'] as const;
export type CampoTraducible = (typeof CAMPOS_TRADUCIBLES)[number];
export type Traducciones = Partial<Record<Locale, Partial<Record<CampoTraducible, string>>>>;

export function leerTraducciones(valor: unknown): Traducciones {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
  return valor as Traducciones;
}

/**
 * El tratamiento en el idioma pedido. El nombre base está en español; si falta
 * la traducción de un campo, se usa el inglés y, si tampoco, el español.
 */
export function traducirServicio<S extends Pick<Service, CampoTraducible | 'translations'>>(
  servicio: S,
  locale: Locale,
): Omit<S, 'translations'> {
  const { translations, ...resto } = servicio;
  const tr = leerTraducciones(translations);
  if (locale === 'es') return resto;
  const salida = { ...resto } as Omit<S, 'translations'> & Record<CampoTraducible, string>;
  for (const campo of CAMPOS_TRADUCIBLES) {
    const valor = tr[locale]?.[campo]?.trim() || tr.en?.[campo]?.trim();
    if (valor) salida[campo] = valor;
  }
  return salida;
}

/**
 * Recorre una respuesta y deja en el idioma pedido cada tratamiento que traiga
 * `translations` (lo quita después). Así el panel en inglés ve «Lip filler» y
 * no «Relleno de labios», sin que cada ruta tenga que acordarse.
 */
export function traducirTratamientos<T>(valor: T, locale: Locale): T {
  if (Array.isArray(valor)) return valor.map((v) => traducirTratamientos(v, locale)) as T;
  if (!valor || typeof valor !== 'object' || valor instanceof Date) return valor;
  const objeto = valor as Record<string, unknown>;
  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(objeto)) salida[clave] = typeof v === 'object' ? traducirTratamientos(v, locale) : v;
  if ('translations' in objeto && typeof objeto.name === 'string') {
    const tr = leerTraducciones(objeto.translations);
    if (locale !== 'es') {
      for (const campo of CAMPOS_TRADUCIBLES) {
        if (!(campo in objeto)) continue;
        const traducido = tr[locale]?.[campo]?.trim() || tr.en?.[campo]?.trim();
        if (traducido) salida[campo] = traducido;
      }
    }
    delete salida.translations;
  }
  return salida as T;
}
