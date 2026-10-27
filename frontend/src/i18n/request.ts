import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const pedido = await requestLocale;
  const locale = hasLocale(routing.locales, pedido) ? pedido : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: process.env.CLINIC_TIMEZONE || 'America/Chicago',
  };
});
