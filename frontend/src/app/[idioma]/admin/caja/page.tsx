'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Lock, LockOpen, Wallet } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { sumarDias } from '@/lib/format';
import { useFormato } from '@/lib/useFormato';
import { METODOS_PAGO, type Pago, type ResumenCaja } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { CampoDinero } from '@/components/admin/CampoDinero';
import { confirmar } from '@/components/admin/Dialogo';
import { CajaError, Cargando, Encabezado, Pestanas, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

type PagoCaja = Pago & { invoice: { id: string; number: number; series: string; clientName: string } };
interface Cierre {
  id: string;
  closeDate: string;
  expectedCash: number;
  expectedOther: number;
  expectedTotal: number;
  countedCash: number;
  difference: number;
  invoiceCount: number;
  invoicedTotal: number;
  notes: string | null;
  closedAt: string;
  closedBy: { fullName: string } | null;
}
interface Datos {
  periodo: 'dia' | 'semana' | 'mes';
  fecha: string;
  resumen: ResumenCaja;
  pagos: PagoCaja[];
  cierre: Cierre | null;
}

function Caja() {
  const t = useTranslations('panel.caja');
  const tPago = useTranslations('estados.pago');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const { leer, poner } = useParametros();
  const periodo = (leer('periodo') as Datos['periodo']) ?? 'dia';
  const fecha = leer('fecha') ?? fmt.hoy();
  const { datos, cargando, error, recargar } = useCarga<Datos>(`/api/caja?fecha=${fecha}&periodo=${periodo}`);
  const cierres = useCarga<{ items: Cierre[] }>('/api/caja/cierre?take=10');
  const [contado, setContado] = useState<number | null>(null);
  const [notas, setNotas] = useState('');
  const [fallo, setFallo] = useState<string | null>(null);

  const paso = periodo === 'dia' ? 1 : periodo === 'semana' ? 7 : 30;

  async function cerrar() {
    if (contado === null) return;
    try {
      await api.post('/api/caja/cierre', { fecha, countedCash: contado, notes: notas || null });
      setContado(null);
      setNotas('');
      recargar();
      cierres.recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function reabrir() {
    if (!(await confirmar({ titulo: t('reabrirTitulo'), mensaje: t('reabrirMensaje'), aceptar: t('reabrir') }))) return;
    try {
      await api.delete(`/api/caja/cierre?fecha=${fecha}`);
      recargar();
      cierres.recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  const r = datos?.resumen;
  const diferencia = contado !== null && r ? contado - r.cobradoPorMedio.EFECTIVO : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Pestanas
          etiqueta={t('periodo')}
          valor={periodo}
          onChange={(v) => poner({ periodo: v === 'dia' ? null : v })}
          opciones={[
            { valor: 'dia', texto: t('dia') },
            { valor: 'semana', texto: t('semana') },
            { valor: 'mes', texto: t('mes') },
          ]}
        />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => poner({ fecha: sumarDias(fecha, -paso) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-50" aria-label={tc('anterior')}>
            <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </button>
          <input type="date" className="field w-44 py-2" value={fecha} onChange={(e) => e.target.value && poner({ fecha: e.target.value })} aria-label={tc('fecha')} />
          <button type="button" onClick={() => poner({ fecha: sumarDias(fecha, paso) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-50" aria-label={tc('siguiente')}>
            <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </button>
        </div>
      </div>
      {(error || fallo) && <CajaError mensaje={error ?? fallo ?? ''} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : r ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4">
                <p className="text-xs font-bold uppercase text-muted">{t('cobrado')}</p>
                <p className="mt-1 font-display text-3xl text-emerald-700">{fmt.dinero(r.cobrado)}</p>
                <p className="text-xs text-muted">{t('nPagos', { n: r.pagos })}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase text-muted">{t('facturado')}</p>
                <p className="mt-1 font-display text-3xl text-brand-900">{fmt.dinero(r.facturado)}</p>
                <p className="text-xs text-muted">{t('nRecibos', { n: r.documentos })}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs font-bold uppercase text-muted">{t('pendiente')}</p>
                <p className="mt-1 font-display text-3xl text-amber-700">{fmt.dinero(r.porCobrar)}</p>
              </div>
            </div>
            <section className="card p-5">
              <h2 className="mb-3 text-lg">{t('porMedio')}</h2>
              <ul className="grid gap-2 sm:grid-cols-3">
                {METODOS_PAGO.map((m) => (
                  <li key={m} className={`rounded-2xl p-3 ${r.cobradoPorMedio[m] ? 'bg-cream' : 'bg-cream/50 text-muted'}`}>
                    <p className="text-xs font-bold">{tPago(m)}</p>
                    <p className="font-bold" dir="ltr">
                      {fmt.dinero(r.cobradoPorMedio[m])}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="card overflow-hidden">
              <h2 className="px-5 pt-5 text-lg">{t('pagos')}</h2>
              {!datos.pagos.length ? (
                <div className="p-5">
                  <Vacio icono={<Wallet className="h-5 w-5" aria-hidden />} titulo={t('sinPagos')} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="mt-3 w-full min-w-[560px] text-sm">
                    <thead className="bg-cream text-xs uppercase text-muted">
                      <tr>
                        <th className="px-5 py-2 text-start">{t('cuando')}</th>
                        <th className="px-5 py-2 text-start">{t('recibo')}</th>
                        <th className="px-5 py-2 text-start">{t('medio')}</th>
                        <th className="px-5 py-2 text-end">{t('monto')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {datos.pagos.map((p) => (
                        <tr key={p.id}>
                          <td className="px-5 py-2.5">{fmt.fechaHora(p.paidAt)}</td>
                          <td className="px-5 py-2.5">
                            <Link href={`/admin/recibos/${p.invoice.id}`} className="font-bold hover:text-brand-600">
                              <span dir="ltr">
                                {p.invoice.series}-{String(p.invoice.number).padStart(5, '0')}
                              </span>
                            </Link>
                            <span className="block text-xs text-muted">{p.invoice.clientName}</span>
                          </td>
                          <td className="px-5 py-2.5">
                            {tPago(p.method)}
                            {p.reference && <span className="block text-xs text-muted">{p.reference}</span>}
                          </td>
                          <td className="px-5 py-2.5 text-end font-bold" dir="ltr">
                            {fmt.dinero(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            {periodo === 'dia' && (
              <section className="card p-5">
                <h2 className="flex items-center gap-2 text-lg">
                  {datos.cierre ? <Lock className="h-5 w-5 text-emerald-600" aria-hidden /> : <LockOpen className="h-5 w-5 text-muted" aria-hidden />}
                  {t('cierre')}
                </h2>
                {datos.cierre ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="rounded-2xl bg-emerald-50 p-3 text-emerald-800">{t('cerradoPor', { nombre: datos.cierre.closedBy?.fullName ?? '—', cuando: fmt.fechaHora(datos.cierre.closedAt) })}</p>
                    <div className="flex justify-between">
                      <span className="text-muted">{t('efectivoEsperado')}</span>
                      <b dir="ltr">{fmt.dinero(datos.cierre.expectedCash)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t('efectivoContado')}</span>
                      <b dir="ltr">{fmt.dinero(datos.cierre.countedCash)}</b>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">{t('diferencia')}</span>
                      <b className={datos.cierre.difference === 0 ? 'text-emerald-700' : 'text-red-600'} dir="ltr">
                        {fmt.dinero(datos.cierre.difference)}
                      </b>
                    </div>
                    {datos.cierre.notes && <p className="text-muted">{datos.cierre.notes}</p>}
                    {usuario.role === 'ADMIN' && (
                      <button type="button" onClick={reabrir} className="btn-outline mt-2 w-full">
                        {t('reabrir')}
                      </button>
                    )}
                  </div>
                ) : fecha > fmt.hoy() ? (
                  <p className="mt-3 text-sm text-muted">{t('futuro')}</p>
                ) : (
                  <div className="mt-3 space-y-3 text-sm">
                    <p className="text-muted">{t('cierreTexto')}</p>
                    <div className="flex justify-between">
                      <span>{t('efectivoEsperado')}</span>
                      <b dir="ltr">{fmt.dinero(r.cobradoPorMedio.EFECTIVO)}</b>
                    </div>
                    <label className="block">
                      <span className="field-label">{t('efectivoContado')}</span>
                      <CampoDinero valor={contado} onChange={setContado} />
                    </label>
                    {diferencia !== null && (
                      <p className={`rounded-2xl p-3 font-bold ${diferencia === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                        {diferencia === 0 ? t('cuadra') : t('noCuadra', { n: fmt.dinero(diferencia) })}
                      </p>
                    )}
                    <textarea className="field min-h-16" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('notas')} />
                    <button type="button" onClick={cerrar} disabled={contado === null} className="btn-primary w-full">
                      <Lock className="h-4 w-4" aria-hidden />
                      {t('cerrarDia')}
                    </button>
                  </div>
                )}
              </section>
            )}
            <section className="card p-5">
              <h2 className="mb-3 text-lg">{t('ultimosCierres')}</h2>
              {!cierres.datos?.items.length ? (
                <p className="text-sm text-muted">{t('sinCierres')}</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {cierres.datos.items.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => poner({ fecha: c.closeDate.slice(0, 10), periodo: null })} className="flex w-full justify-between gap-2 py-2 text-start hover:text-brand-600">
                        <span>{fmt.fechaDia(fmt.diaEnClinica(c.closeDate))}</span>
                        <span className={c.difference === 0 ? 'text-emerald-700' : 'font-bold text-red-600'} dir="ltr">
                          {c.difference === 0 ? '✓' : fmt.dinero(c.difference)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Caja />
    </Suspense>
  );
}
