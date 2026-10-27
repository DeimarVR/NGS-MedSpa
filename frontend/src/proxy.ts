import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Proxy de Next 16 (antes «middleware»). Solo hace una cosa: poner el idioma
 * en la ruta. La sesión del panel NO se decide aquí: la valida cada ruta de la
 * API, que es donde de verdad se protege.
 */
export const proxy = createMiddleware(routing);

export const config = {
  // Todo menos la API, los archivos internos de Next y los archivos con extensión.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
