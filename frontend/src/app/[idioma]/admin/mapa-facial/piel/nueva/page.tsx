'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PielForm } from '@/components/admin/mapa/PielForm';
import { Encabezado } from '@/components/admin/ui';

function Nueva() {
  const t = useTranslations('panel.piel');
  const params = useSearchParams();
  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('nueva')} bajada={t('nuevaBajada')} />
      <PielForm citaId={params.get('cita')} clientaId={params.get('clienta')} />
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Nueva />
    </Suspense>
  );
}
