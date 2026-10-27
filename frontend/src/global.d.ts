import type { routing } from '@/i18n/routing';
import type mensajes from '../messages/es.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof mensajes;
  }
}
