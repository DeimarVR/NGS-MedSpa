import { defineRouting } from 'next-intl/routing';

/**
 * Los cinco idiomas del sitio y del panel.
 *
 * La ruta siempre lleva el idioma delante (/es, /en…). Si alguien entra a la
 * raíz, el proxy elige según el navegador y, si no sabe, manda a inglés: la
 * clínica está en Dallas.
 */
export const routing = defineRouting({
  locales: ['es', 'en', 'fr', 'ar', 'ja'],
  defaultLocale: 'en',
  localePrefix: 'always',
  localeCookie: { name: 'NGS_IDIOMA', maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
