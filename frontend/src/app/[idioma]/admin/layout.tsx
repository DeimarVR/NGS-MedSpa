import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PanelShell } from '@/components/admin/PanelShell';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ idioma: string }> }): Promise<Metadata> {
  const { idioma } = await params;
  const t = await getTranslations({ locale: idioma as Locale, namespace: 'panel.shell' });
  return { title: { default: t('titulo'), template: `%s · ${t('titulo')}` }, robots: { index: false, follow: false } };
}

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
