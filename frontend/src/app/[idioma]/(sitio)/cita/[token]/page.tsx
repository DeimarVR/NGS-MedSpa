import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { GestionCita } from '@/components/booking/GestionCita';
import { MarcoPublico } from '@/components/site/MarcoPublico';

export async function generateMetadata({ params }: { params: Promise<{ idioma: string }> }): Promise<Metadata> {
  const { idioma } = await params;
  const t = await getTranslations({ locale: idioma as Locale, namespace: 'publico.cita' });
  return { title: t('titulo'), robots: { index: false, follow: false } };
}

export default async function PaginaCita({ params }: { params: Promise<{ idioma: string; token: string }> }) {
  const { idioma, token } = await params;
  setRequestLocale(idioma as Locale);
  return (
    <MarcoPublico>
      <GestionCita token={token} />
    </MarcoPublico>
  );
}
