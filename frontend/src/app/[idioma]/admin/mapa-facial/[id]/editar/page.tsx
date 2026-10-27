'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import type { MapaFacial } from '@/lib/types';
import { MapaForm } from '@/components/admin/mapa/MapaForm';
import { CajaError, Cargando, Encabezado } from '@/components/admin/ui';
import { useCarga } from '@/components/admin/useCarga';

export default function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('panel.mapa');
  const { datos, cargando, error, recargar } = useCarga<MapaFacial>(`/api/clinical-records/${id}`);
  if (cargando && !datos) return <Cargando />;
  if (error || !datos) return <CajaError mensaje={error ?? ''} onReintentar={recargar} />;
  return (
    <div className="mx-auto max-w-7xl">
      <Encabezado titulo={t('editar')} bajada={datos.patientName} />
      <MapaForm existente={datos} />
    </div>
  );
}
