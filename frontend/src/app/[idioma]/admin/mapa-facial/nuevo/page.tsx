'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MapaForm } from '@/components/admin/mapa/MapaForm';
import { Encabezado } from '@/components/admin/ui';

function Nuevo() {
  const t = useTranslations('panel.mapa');
  const params = useSearchParams();
  return (
    <div className="mx-auto max-w-7xl">
      <Encabezado titulo={t('nuevo')} bajada={t('nuevoBajada')} />
      <MapaForm citaId={params.get('cita')} clientaId={params.get('clienta')} />
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
