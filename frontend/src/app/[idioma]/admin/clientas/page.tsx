'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlus, Users } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { IDIOMAS, aLocale } from '@/lib/idiomas';
import { useFormato } from '@/lib/useFormato';
import type { PatientListItem } from '@/lib/types';
import { ClientaForm } from '@/components/admin/clientas/ClientaForm';
import { CajaError, Cargando, CampoBusqueda, Encabezado, Ltr, Pastilla, Pestanas, Vacio } from '@/components/admin/ui';
import { useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

function Lista() {
  const t = useTranslations('panel.clientas');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const router = useRouter();
  const { leer, poner } = useParametros();
  const [q, setQ] = useState('');
  const [cuantas, setCuantas] = useState(40);
  const estado = leer('estado') === 'archivadas' ? 'archivadas' : 'activas';
  const [nueva, setNueva] = useState(Boolean(leer('nueva')));
  const { datos, cargando, error, recargar } = useCarga<{ items: PatientListItem[]; total: number }>(
    `/api/patients?take=${cuantas}&active=${estado === 'activas'}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button type="button" onClick={() => setNueva(true)} className="btn-grad">
          <UserPlus className="h-4 w-4" aria-hidden />
          {t('nueva')}
        </button>
      </Encabezado>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Pestanas
          etiqueta={t('estado')}
          valor={estado}
          onChange={(v) => poner({ estado: v === 'activas' ? null : v })}
          opciones={[
            { valor: 'activas', texto: t('activas') },
            { valor: 'archivadas', texto: t('archivadas') },
          ]}
        />
        <CampoBusqueda valor={q} onChange={setQ} placeholder={t('buscar')} className="sm:ms-auto sm:w-80" />
      </div>
      {error && <CajaError mensaje={error} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<Users className="h-5 w-5" aria-hidden />} titulo={q ? tc('sinResultados') : t('vacio')} texto={q ? undefined : t('vacioTexto')} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-cream text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t('nombre')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('contacto')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('idioma')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('actividad')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('actualizada')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {datos.items.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/admin/clientas/${p.id}`)} className="cursor-pointer hover:bg-brand-50/60">
                    <td className="px-4 py-3">
                      <p className="font-bold">{p.fullName}</p>
                      {p.city && <p className="text-xs text-muted">{p.city}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p>
                        <Ltr>{fmt.telefono(p.phone)}</Ltr>
                      </p>
                      {p.email && <p className="text-xs text-muted">{p.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Pastilla tono="gris">{IDIOMAS[aLocale(p.preferredLocale)].corto}</Pastilla>
                    </td>
                    <td className="px-4 py-3 text-muted">{t('cuenta', { citas: p._count.appointments, mapas: p._count.records })}</td>
                    <td className="px-4 py-3 text-muted">{fmt.relativo(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.total > datos.items.length && (
            <div className="border-t border-line p-3 text-center">
              <button type="button" onClick={() => setCuantas((n) => n + 40)} className="btn-ghost">
                {tc('cargarMas')} ({datos.items.length}/{datos.total})
              </button>
            </div>
          )}
        </div>
      )}
      <ClientaForm
        abierto={nueva}
        clienta={null}
        nombreInicial={q.trim() && !/\d/.test(q) ? q.trim() : undefined}
        onCerrar={() => {
          setNueva(false);
          poner({ nueva: null });
        }}
        onGuardada={(p) => router.push(`/admin/clientas/${p.id}`)}
      />
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
