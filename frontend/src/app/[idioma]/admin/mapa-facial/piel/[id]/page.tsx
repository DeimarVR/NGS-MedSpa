'use client';

import { Suspense, use, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil, Printer, Trash2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import type { FichaPiel } from '@/lib/types';
import { PielHoja } from '@/components/admin/mapa/PielHoja';
import { confirmar } from '@/components/admin/Dialogo';
import { CajaError, CajaOk, Cargando } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

function Ver({ id }: { id: string }) {
  const t = useTranslations('panel.piel');
  const tc = useTranslations('comun');
  const router = useRouter();
  const params = useSearchParams();
  const { datos, cargando, error, recargar } = useCarga<FichaPiel>(`/api/facial/${id}`);
  const [fallo, setFallo] = useState<string | null>(null);

  async function borrar() {
    if (!(await confirmar({ titulo: t('borrarTitulo'), mensaje: t('borrarMensaje'), aceptar: tc('eliminar'), peligro: true }))) return;
    try {
      await api.delete(`/api/facial/${id}`);
      router.replace('/admin/mapa-facial');
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  if (cargando && !datos) return <Cargando />;
  if (error || !datos) return <CajaError mensaje={error ?? ''} onReintentar={recargar} />;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="no-imprimir flex flex-wrap items-center justify-between gap-2">
        <Link href={`/admin/clientas/${datos.patientId}`} className="text-sm font-bold text-muted hover:text-brand-700">
          ← {datos.patientName}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="btn-outline px-4 py-2">
            <Printer className="h-4 w-4" aria-hidden />
            {tc('imprimir')}
          </button>
          <Link href={`/admin/mapa-facial/piel/${id}/editar`} className="btn-primary px-4 py-2">
            <Pencil className="h-4 w-4" aria-hidden />
            {t('agregarOEditar')}
          </Link>
          <button type="button" onClick={borrar} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('eliminar')}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {params.get('guardado') && <CajaOk mensaje={[t('guardada'), params.get('avisos')].filter(Boolean).join(' · ')} />}
      {fallo && <CajaError mensaje={fallo} />}
      <PielHoja ficha={datos} />
    </div>
  );
}

export default function Pagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <Ver id={id} />
    </Suspense>
  );
}
