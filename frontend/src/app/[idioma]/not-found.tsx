import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NoEncontrada() {
  const t = useTranslations('comun');
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-7xl text-accent-500">404</p>
        <h1 className="mt-4 text-2xl">{t('noEncontrada')}</h1>
        <Link href="/" className="btn-primary mt-8">
          {t('volverAlInicio')}
        </Link>
      </div>
    </main>
  );
}
