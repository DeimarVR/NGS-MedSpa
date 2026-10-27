'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardList, Plus, Sparkles } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useFormato } from '@/lib/useFormato';
import { CajaError, Cargando, CampoBusqueda, Encabezado, Pastilla, Pestanas, Vacio } from '@/components/admin/ui';
import { useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

interface Fila {
  id: string;
  tipo: 'MAPA' | 'PIEL';
  fecha: string;
  patientName: string;
  patient: { id: string; fullName: string };
  servicio: string | null;
  detalle: number;
  totales: Record<string, number>;
}

function Lista() {
  const t = useTranslations('panel.mapa.lista');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const router = useRouter();
  const { leer, poner } = useParametros();
  const tipo = (leer('tipo') as 'MAPA' | 'PIEL' | null) ?? '';
  const [q, setQ] = useState('');
  const [cuantas, setCuantas] = useState(40);
  const { datos, cargando, error, recargar } = useCarga<{ items: Fila[]; total: number }>(
    `/api/clinical-records?take=${cuantas}${tipo ? `&tipo=${tipo}` : ''}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <Link href="/admin/mapa-facial/piel/nueva" className="btn-outline">
          <Sparkles className="h-4 w-4" aria-hidden />
          {t('nuevaPiel')}
        </Link>
        <Link href="/admin/mapa-facial/nuevo" className="btn-grad">
          <Plus className="h-4 w-4" aria-hidden />
          {t('nuevoMapa')}
        </Link>
      </Encabezado>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Pestanas
          etiqueta={t('tipo')}
          valor={tipo || 'TODOS'}
          onChange={(v) => poner({ tipo: v === 'TODOS' ? null : v })}
          opciones={[
            { valor: 'TODOS', texto: tc('todos') },
            { valor: 'MAPA', texto: t('mapas') },
            { valor: 'PIEL', texto: t('pieles') },
          ]}
        />
        <CampoBusqueda valor={q} onChange={setQ} placeholder={t('buscar')} className="sm:ms-auto sm:w-80" />
      </div>
      {error && <CajaError mensaje={error} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<ClipboardList className="h-5 w-5" aria-hidden />} titulo={t('vacio')} texto={t('vacioTexto')} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {datos.items.map((f) => (
            <li key={`${f.tipo}-${f.id}`}>
              <button
                type="button"
                onClick={() => router.push(f.tipo === 'MAPA' ? `/admin/mapa-facial/${f.id}` : `/admin/mapa-facial/piel/${f.id}`)}
                className="card flex w-full items-start gap-4 p-4 text-start transition-transform hover:-translate-y-0.5"
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${f.tipo === 'MAPA' ? 'bg-brand-100 text-brand-700' : 'bg-accent-100 text-accent-700'}`}>
                  {f.tipo === 'MAPA' ? <ClipboardList className="h-5 w-5" aria-hidden /> : <Sparkles className="h-5 w-5" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{f.patient?.fullName ?? f.patientName}</span>
                    <span className="shrink-0 text-xs text-muted">{fmt.fechaDia(f.fecha.slice(0, 10))}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{f.servicio ?? (f.tipo === 'MAPA' ? t('mapa') : t('piel'))}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    <Pastilla tono={f.tipo === 'MAPA' ? 'azul' : 'oro'}>{f.tipo === 'MAPA' ? t('nPuntos', { n: f.detalle }) : t('nSesiones', { n: f.detalle })}</Pastilla>
                    {Object.entries(f.totales).map(([u, total]) => (
                      <Pastilla key={u} tono="gris">
                        {fmt.numero(total, 2)} {u}
                      </Pastilla>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {datos && datos.total > datos.items.length && (
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setCuantas((n) => n + 40)} className="btn-ghost">
            {tc('cargarMas')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Lista />
    </Suspense>
  );
}
