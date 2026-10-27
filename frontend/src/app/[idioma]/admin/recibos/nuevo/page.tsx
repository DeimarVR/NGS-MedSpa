'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ReciboForm } from '@/components/admin/recibos/ReciboForm';
import { Encabezado } from '@/components/admin/ui';

function Nuevo() {
  const t = useTranslations('panel.recibos');
  const params = useSearchParams();
  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('nuevo')} bajada={t('nuevoBajada')} />
      <ReciboForm citaId={params.get('cita')} clientaId={params.get('clienta')} />
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Nuevo />
    </Suspense>
  );
}
