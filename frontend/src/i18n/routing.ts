import { defineRouting } from 'next-intl/routing';

/**
 * Los cinco idiomas del sitio y del panel.
 *
 * La ruta siempre lleva el idioma delante (/en, /es…). Quien entra a la raíz
 * va SIEMPRE a inglés (no se adivina por el navegador): la clínica está en
 * Dallas. Si la persona eligió otro idioma, se recuerda en la cookie.
 */
export const routing = defineRouting({
  locales: ['en', 'es', 'fr', 'ar', 'ja'],
  defaultLocale: 'en',
  localeDetection: false,
  localePrefix: 'always',
  localeCookie: { name: 'NGS_IDIOMA', maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
