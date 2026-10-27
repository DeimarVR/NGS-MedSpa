'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Receipt } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { sumarDias } from '@/lib/format';
import { useFormato } from '@/lib/useFormato';
import { METODOS_PAGO, type Recibo, type ResumenCaja } from '@/lib/types';
import { CajaError, Cargando, CampoBusqueda, Encabezado, Pastilla, Pestanas, TONO_RECIBO, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

type Periodo = 'dia' | 'semana' | 'mes' | 'todo';
interface Listado {
  items: Recibo[];
  total: number;
  sumaTotal: number;
  sumaSaldo: number;
  fecha: string;
  resumen: ResumenCaja;
}

function mover(fecha: string, periodo: Periodo, paso: number): string {
  if (periodo === 'dia') return sumarDias(fecha, paso);
  if (periodo === 'semana') return sumarDias(fecha, 7 * paso);
  const [a, m] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + paso, 1)).toISOString().slice(0, 10);
}

function Lista() {
  const t = useTranslations('panel.recibos');
  const tDoc = useTranslations('estados.documento');
  const tEst = useTranslations('estados.recibo');
  const tPago = useTranslations('estados.pago');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const router = useRouter();
  const { leer, poner } = useParametros();
  const periodo = (leer('periodo') as Periodo) ?? 'mes';
  const fecha = leer('fecha') ?? fmt.hoy();
  const tipo = leer('tipo') ?? '';
  const estado = leer('estado') ?? '';
  const [q, setQ] = useState('');
  const [cuantos, setCuantos] = useState(40);
  const [fallo, setFallo] = useState<string | null>(null);
  const filtros = `periodo=${periodo}&fecha=${fecha}${tipo ? `&type=${tipo}` : ''}${estado ? `&status=${estado}` : ''}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`;
  const { datos, cargando, error, recargar } = useCarga<Listado>(`/api/invoices?${filtros}&take=${cuantos}`);

  const rotulo =
    periodo === 'todo'
      ? t('todo')
      : periodo === 'mes'
        ? new Intl.DateTimeFormat(fmt.intl, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${fecha.slice(0, 7)}-15T12:00:00Z`))
        : periodo === 'dia'
          ? fmt.fechaDia(fecha, 'larga')
          : t('semanaDe', { fecha: fmt.fechaDia(fecha) });

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button
          type="button"
          onClick={() => api.descargar(`/api/invoices/exportar?${filtros}`, 'recibos.xlsx').catch((e) => setFallo(mensajeDe(e)))}
          className="btn-outline"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Excel
        </button>
        <Link href="/admin/recibos/nuevo" className="btn-grad">
          <Plus className="h-4 w-4" aria-hidden />
          {t('nuevo')}
        </Link>
      </Encabezado>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Pestanas
          etiqueta={t('periodo')}
          valor={periodo}
          onChange={(v) => poner({ periodo: v === 'mes' ? null : v })}
          opciones={[
            { valor: 'dia', texto: t('dia') },
            { valor: 'semana', texto: t('semana') },
            { valor: 'mes', texto: t('mes') },
            { valor: 'todo', texto: t('todo') },
          ]}
        />
        {periodo !== 'todo' && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => poner({ fecha: mover(fecha, periodo, -1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-50" aria-label={tc('anterior')}>
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </button>
            <p className="min-w-40 text-center font-bold first-letter:uppercase text-brand-900">{rotulo}</p>
            <button type="button" onClick={() => poner({ fecha: mover(fecha, periodo, 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-50" aria-label={tc('siguiente')}>
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {datos && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-muted">{t('facturado')}</p>
            <p className="mt-1 font-display text-2xl text-brand-900">{fmt.dinero(datos.resumen.facturado)}</p>
            <p className="text-xs text-muted">{t('nRecibos', { n: datos.resumen.documentos })}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-muted">{t('cobrado')}</p>
            <p className="mt-1 font-display text-2xl text-emerald-700">{fmt.dinero(datos.resumen.cobrado)}</p>
            <p className="truncate text-xs text-muted">
              {METODOS_PAGO.filter((m) => datos.resumen.cobradoPorMedio[m])
                .map((m) => `${tPago(m)} ${fmt.dinero(datos.resumen.cobradoPorMedio[m], true)}`)
                .join(' · ') || '—'}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase text-muted">{t('porCobrar')}</p>
            <p className="mt-1 font-display text-2xl text-amber-700">{fmt.dinero(datos.resumen.porCobrar)}</p>
            <Link href="/admin/por-cobrar" className="text-xs font-bold text-brand-600 hover:underline">
              {t('verPorCobrar')}
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <select value={tipo} onChange={(e) => poner({ tipo: e.target.value || null })} className="field py-2 sm:w-44" aria-label={t('tipo')}>
          <option value="">{t('todosLosTipos')}</option>
          <option value="RECIBO">{tDoc('RECIBO')}</option>
          <option value="COTIZACION">{tDoc('COTIZACION')}</option>
        </select>
        <select value={estado} onChange={(e) => poner({ estado: e.target.value || null })} className="field py-2 sm:w-52" aria-label={t('estado')}>
          <option value="">{t('todosLosEstados')}</option>
          {(['EMITIDA', 'PAGADA', 'ANULADA'] as const).map((s) => (
            <option key={s} value={s}>
              {tEst(s)}
            </option>
          ))}
        </select>
        <CampoBusqueda valor={q} onChange={setQ} placeholder={t('buscar')} className="sm:ms-auto sm:w-80" />
      </div>

      {(error || fallo) && <CajaError mensaje={error ?? fallo ?? ''} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<Receipt className="h-5 w-5" aria-hidden />} titulo={t('vacio')} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-cream text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">{t('numero')}</th>
                  <th className="px-4 py-3 text-start">{t('fecha')}</th>
                  <th className="px-4 py-3 text-start">{t('clienta')}</th>
                  <th className="px-4 py-3 text-end">{t('total')}</th>
                  <th className="px-4 py-3 text-end">{t('saldo')}</th>
                  <th className="px-4 py-3 text-start">{t('estado')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {datos.items.map((d) => (
                  <tr key={d.id} onClick={() => router.push(`/admin/recibos/${d.id}`)} className={`cursor-pointer hover:bg-brand-50/60 ${d.status === 'ANULADA' ? 'text-muted line-through' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-bold" dir="ltr">
                        {d.series}-{String(d.number).padStart(5, '0')}
                      </span>
                      {d.type === 'COTIZACION' && <span className="block text-xs text-accent-700">{tDoc('COTIZACION')}</span>}
                    </td>
                    <td className="px-4 py-3">{fmt.fechaDia(d.issueDate.slice(0, 10))}</td>
                    <td className="px-4 py-3 font-bold">{d.clientName}</td>
                    <td className="px-4 py-3 text-end font-bold" dir="ltr">
                      {fmt.dinero(d.total)}
                    </td>
                    <td className="px-4 py-3 text-end" dir="ltr">
                      {d.type === 'RECIBO' && d.balance > 0 && d.status !== 'ANULADA' ? <span className="font-bold text-amber-700">{fmt.dinero(d.balance)}</span> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Pastilla tono={TONO_RECIBO[d.status]}>{tEst(d.status)}</Pastilla>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.total > datos.items.length && (
            <div className="border-t border-line p-3 text-center">
              <button type="button" onClick={() => setCuantos((n) => n + 40)} className="btn-ghost">
                {tc('cargarMas')} ({datos.items.length}/{datos.total})
              </button>
            </div>
          )}
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
