import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { IDIOMAS } from '@/lib/idiomas';

// Tipografías autoalojadas: el sitio no pide nada a Google Fonts.
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/800.css';
import '@fontsource/playfair-display/600-italic.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-700.css';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((idioma) => ({ idioma }));
}

export async function generateMetadata({ params }: { params: Promise<{ idioma: string }> }): Promise<Metadata> {
  const { idioma } = await params;
  if (!hasLocale(routing.locales, idioma)) return {};
  const t = await getTranslations({ locale: idioma, namespace: 'meta' });
  const base = process.env.PUBLIC_WEB_URL || 'http://localhost:3000';
  return {
    metadataBase: new URL(base),
    title: { default: t('titulo'), template: `%s · NGS MedSpa` },
    description: t('descripcion'),
    alternates: {
      canonical: `/${idioma}`,
      languages: Object.fromEntries(routing.locales.map((l) => [IDIOMAS[l].intl.split('-u-')[0], `/${l}`])),
    },
    openGraph: { title: t('titulo'), description: t('descripcion'), siteName: 'NGS MedSpa', type: 'website' },
  };
}

export const viewport: Viewport = {
  themeColor: '#0F1A2E',
  width: 'device-width',
  initialScale: 1,
};

export default async function LayoutDeIdioma({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ idioma: string }>;
}) {
  const { idioma } = await params;
  if (!hasLocale(routing.locales, idioma)) notFound();
  setRequestLocale(idioma);

  return (
    <html lang={idioma} dir={IDIOMAS[idioma].dir} data-scroll-behavior="smooth">
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
