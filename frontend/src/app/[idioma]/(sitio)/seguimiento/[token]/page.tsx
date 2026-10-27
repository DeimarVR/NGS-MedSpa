import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { MarcoPublico } from '@/components/site/MarcoPublico';
import { Seguimiento } from '@/components/tracking/Seguimiento';

export async function generateMetadata({ params }: { params: Promise<{ idioma: string }> }): Promise<Metadata> {
  const { idioma } = await params;
  const t = await getTranslations({ locale: idioma as Locale, namespace: 'publico.seguimiento' });
  return { title: t('titulo'), robots: { index: false, follow: false } };
}

export default async function PaginaSeguimiento({ params }: { params: Promise<{ idioma: string; token: string }> }) {
  const { idioma, token } = await params;
  setRequestLocale(idioma as Locale);
  return (
    <MarcoPublico>
      <Seguimiento token={token} />
    </MarcoPublico>
  );
}
