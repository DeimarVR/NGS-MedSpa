'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileSpreadsheet, HandCoins } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import { Contactar } from '@/components/admin/Contactar';
import { CajaError, Cargando, CampoBusqueda, Encabezado, Pastilla, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

interface Pendiente {
  id: string;
  numero: string;
  issueDate: string;
  total: number;
  deposit: number;
  balance: number;
  dias: number;
}
interface QuienDebe {
  clave: string;
  nombre: string;
  patientId: string | null;
  correo: string | null;
  telefono: string | null;
  debe: number;
  recibos: Pendiente[];
  diasDelMasViejo: number;
}

export default function PorCobrar() {
  const t = useTranslations('panel.porCobrar');
  const fmt = useFormato();
  const [q, setQ] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);
  const { datos, cargando, error, recargar } = useCarga<{ items: QuienDebe[]; debenEnTotal: number; clientas: number }>(`/api/por-cobrar${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);

  return (
    <div className="mx-auto max-w-5xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button type="button" onClick={() => api.descargar('/api/por-cobrar/exportar', 'por-cobrar.xlsx').catch((e) => setFallo(mensajeDe(e)))} className="btn-outline">
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Excel
        </button>
      </Encabezado>
      {datos && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-muted">{t('total')}</p>
            <p className="mt-1 font-display text-3xl text-amber-700">{fmt.dinero(datos.debenEnTotal)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-muted">{t('clientas')}</p>
            <p className="mt-1 font-display text-3xl text-brand-900">{datos.clientas}</p>
          </div>
        </div>
      )}
      <CampoBusqueda valor={q} onChange={setQ} placeholder={t('buscar')} className="mb-4" />
      {(error || fallo) && <CajaError mensaje={error ?? fallo ?? ''} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<HandCoins className="h-5 w-5" aria-hidden />} titulo={t('nadie')} />
      ) : (
        <ul className="space-y-3">
          {datos.items.map((c) => (
            <li key={c.clave} className="card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  {c.patientId ? (
                    <Link href={`/admin/clientas/${c.patientId}`} className="font-bold hover:text-brand-600">
                      {c.nombre}
                    </Link>
                  ) : (
                    <p className="font-bold">{c.nombre}</p>
                  )}
                  <p className="text-sm text-muted">
                    {t('nRecibos', { n: c.recibos.length })} · {t('desdeHace', { n: c.diasDelMasViejo })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-display text-2xl text-amber-700">{fmt.dinero(c.debe)}</p>
                  {c.diasDelMasViejo > 30 && <Pastilla tono="rojo">{t('vencido')}</Pastilla>}
                </div>
              </div>
              <ul className="mt-3 divide-y divide-line rounded-2xl bg-cream px-4">
                {c.recibos.map((r) => (
                  <li key={r.id}>
                    <Link href={`/admin/recibos/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-600">
                      <span>
                        <b dir="ltr">{r.numero}</b> · {fmt.fechaDia(String(r.issueDate).slice(0, 10))}
                      </span>
                      <span className="text-end">
                        <b dir="ltr">{fmt.dinero(r.balance)}</b>
                        <span className="ms-2 text-xs text-muted">
                          {t('de')} {fmt.dinero(r.total)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {c.telefono && (
                <div className="mt-3">
                  <Contactar compacto telefono={c.telefono} correo={c.correo} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
