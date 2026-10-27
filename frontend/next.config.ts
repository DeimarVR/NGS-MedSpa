import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const conIdiomas = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Configuración de Next.
 *
 * Las cabeceras de seguridad van todas aquí, a la vista: una cabecera que falta
 * no da ningún error, simplemente no protege.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `next dev` escribe un AGENTS.md en la carpeta si no se le dice que no.
  agentRules: false,
  images: {
    // Las fotos clínicas NO pasan por el optimizador: se sirven por
    // /api/archivos con permiso. Aquí solo entran imágenes del propio sitio.
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      {
        source: '/:ruta*',
        headers: [
          // Nadie puede meter el sitio en un marco ajeno (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // El navegador respeta el tipo declarado y no adivina.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Los enlaces de la clienta llevan su token en la dirección: al salir
          // del sitio solo se manda el dominio.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // La cámara se deja para el propio sitio: en el panel se toman fotos
          // clínicas desde la tablet.
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        // El panel no tiene nada que hacer en un buscador.
        source: '/:idioma/admin/:ruta*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default conIdiomas(nextConfig);
