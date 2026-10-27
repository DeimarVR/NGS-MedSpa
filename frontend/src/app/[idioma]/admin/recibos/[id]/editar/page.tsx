'use client';

import { use } from 'react';
import { useTranslations } from 'next-intl';
import type { Recibo } from '@/lib/types';
import { ReciboForm } from '@/components/admin/recibos/ReciboForm';
import { CajaError, Cargando, Encabezado } from '@/components/admin/ui';
import { useCarga } from '@/components/admin/useCarga';

export default function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('panel.recibos');
  const { datos, cargando, error, recargar } = useCarga<Recibo>(`/api/invoices/${id}`);
  if (cargando && !datos) return <Cargando />;
  if (error || !datos) return <CajaError mensaje={error ?? ''} onReintentar={recargar} />;
  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('editar', { numero: `${datos.series}-${String(datos.number).padStart(5, '0')}` })} bajada={datos.clientName} />
      <ReciboForm existente={datos} />
    </div>
  );
}
