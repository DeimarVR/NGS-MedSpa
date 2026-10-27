'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import type { FichaPiel } from '@/lib/types';
import { PielForm } from '@/components/admin/mapa/PielForm';
import { CajaError, Cargando, Encabezado } from '@/components/admin/ui';
import { useCarga } from '@/components/admin/useCarga';

export default function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('panel.piel');
  const { datos, cargando, error, recargar } = useCarga<FichaPiel>(`/api/facial/${id}`);
  if (cargando && !datos) return <Cargando />;
  if (error || !datos) return <CajaError mensaje={error ?? ''} onReintentar={recargar} />;
  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('editar')} bajada={datos.patientName} />
      <PielForm existente={datos} />
    </div>
  );
}
