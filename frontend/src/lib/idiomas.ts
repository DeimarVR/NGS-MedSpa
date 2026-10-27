import type { Locale } from '@/i18n/routing';

/** Lo que cada idioma necesita además de sus textos. */
export const IDIOMAS: Record<
  Locale,
  { nombre: string; corto: string; dir: 'ltr' | 'rtl'; intl: string; enum: 'ES' | 'EN' | 'FR' | 'AR' | 'JA' }
> = {
  es: { nombre: 'Español', corto: 'ES', dir: 'ltr', intl: 'es-US', enum: 'ES' },
  en: { nombre: 'English', corto: 'EN', dir: 'ltr', intl: 'en-US', enum: 'EN' },
  fr: { nombre: 'Français', corto: 'FR', dir: 'ltr', intl: 'fr-CA', enum: 'FR' },
  // Cifras occidentales: los precios y teléfonos de EE. UU. se leen así.
  ar: { nombre: 'العربية', corto: 'AR', dir: 'rtl', intl: 'ar-u-nu-latn', enum: 'AR' },
  ja: { nombre: '日本語', corto: 'JA', dir: 'ltr', intl: 'ja-JP', enum: 'JA' },
};

export const LISTA_IDIOMAS = Object.keys(IDIOMAS) as Locale[];

export type IdiomaEnum = (typeof IDIOMAS)[Locale]['enum'];

export function localeDeEnum(valor: string | null | undefined): Locale {
  const encontrado = LISTA_IDIOMAS.find((l) => IDIOMAS[l].enum === valor);
  return encontrado ?? 'en';
}

export function enumDeLocale(locale: string | null | undefined): IdiomaEnum {
  return IDIOMAS[(LISTA_IDIOMAS as string[]).includes(locale ?? '') ? (locale as Locale) : 'en'].enum;
}

export function esLocale(valor: string | null | undefined): valor is Locale {
  return (LISTA_IDIOMAS as string[]).includes(valor ?? '');
}

/** Acepta «es» o «ES» (la API devuelve uno u otro según la ruta). */
export function aLocale(valor: string | null | undefined): Locale {
  return esLocale(valor) ? valor : localeDeEnum(valor);
}
