import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';
import { MarcoPublico } from '@/components/site/MarcoPublico';
import { TextoConsentimiento } from '@/components/admin/TextoConsentimiento';

const PAGINAS = ['privacidad', 'terminos', 'consentimientos'] as const;
type Pagina = (typeof PAGINAS)[number];
const esPagina = (p: string): p is Pagina => (PAGINAS as readonly string[]).includes(p);

export function generateStaticParams() {
  return routing.locales.flatMap((idioma) => PAGINAS.map((pagina) => ({ idioma, pagina })));
}

export async function generateMetadata({ params }: { params: Promise<{ idioma: string; pagina: string }> }): Promise<Metadata> {
  const { idioma, pagina } = await params;
  if (!esPagina(pagina)) return {};
  const t = await getTranslations({ locale: idioma as Locale, namespace: 'publico.legal' });
  return { title: t(`${pagina}.titulo`) };
}

export default async function PaginaLegal({ params }: { params: Promise<{ idioma: string; pagina: string }> }) {
  const { idioma, pagina } = await params;
  if (!esPagina(pagina)) notFound();
  setRequestLocale(idioma as Locale);
  const t = await getTranslations('publico.legal');
  return (
    <MarcoPublico>
      <div className="shell py-10 sm:py-14">
        <article className="mx-auto max-w-3xl rounded-[2rem] bg-surface p-6 shadow-soft sm:p-10">
          <p className="eyebrow">{t('kicker')}</p>
          <h1 className="mt-4 text-4xl text-brand-900">{t(`${pagina}.titulo`)}</h1>
          <p className="mt-2 text-sm text-muted">{t('actualizado')}</p>
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t('modelo')}</p>
          <div className="mt-6">
            <TextoConsentimiento texto={t(`${pagina}.texto`)} />
          </div>
        </article>
      </div>
    </MarcoPublico>
  );
}
