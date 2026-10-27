import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { MarcoPublico } from '@/components/site/MarcoPublico';
import { Reserva } from '@/components/booking/Reserva';
import { datosClinica } from '@/server/consultas';

export async function generateMetadata({ params }: { params: Promise<{ idioma: string }> }): Promise<Metadata> {
  const { idioma } = await params;
  const t = await getTranslations({ locale: idioma as Locale, namespace: 'publico.reserva' });
  return { title: t('titulo'), description: t('bajada') };
}

export default async function PaginaReserva({ params }: { params: Promise<{ idioma: string }> }) {
  const { idioma } = await params;
  setRequestLocale(idioma as Locale);
  const clinica = await datosClinica();
  return (
    <MarcoPublico>
      <Suspense>
        <Reserva telefono={clinica.telefono} telefonoEnlace={clinica.telefonoEnlace} />
      </Suspense>
    </MarcoPublico>
  );
}
