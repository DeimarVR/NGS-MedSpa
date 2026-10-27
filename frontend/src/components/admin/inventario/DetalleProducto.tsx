'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, ArrowDownLeft, ArrowUpRight, Ban, Pencil, Route, Undo2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import type { Producto, StockMoveReason, StockMoveType } from '@/lib/types';
import { useUsuario } from '../AuthGuard';
import { confirmar, pedirTexto } from '../Dialogo';
import { CajaError, Cargando, Modal, Pastilla, Pestanas } from '../ui';
import { mensajeDe, useCarga } from '../useCarga';

interface Movimiento {
  id: string;
  type: StockMoveType;
  reason: StockMoveReason;
  quantity: number;
  occurredAt: string;
  notes: string | null;
  corregido: boolean;
  correctsId: string | null;
  clinicalEntryId: string | null;
  facialEntryId: string | null;
  invoiceId: string | null;
  lot: { id: string; lotNumber: string } | null;
  patient: { id: string; fullName: string } | null;
  createdBy: { fullName: string } | null;
}
interface Traza {
  lote: { lotNumber: string; stock: number; product: { name: string; unit: string } };
  aplicaciones: Array<{ patientId: string; nombre: string; telefono: string; fecha: string; cantidad: number; unidad: string; enlace: string | null }>;
}

export function DetalleProducto({ producto, onCerrar, onEditar, onCambio }: { producto: Producto | null; onCerrar: () => void; onEditar: () => void; onCambio: () => void }) {
  const t = useTranslations('panel.inventario.detalle');
  const tMotivo = useTranslations('estados.motivo');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const [pestana, setPestana] = useState<'lotes' | 'movimientos'>('lotes');
  const [traza, setTraza] = useState<Traza | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const movs = useCarga<{ items: Movimiento[] }>(producto && pestana === 'movimientos' ? `/api/inventario/movimientos?productId=${producto.id}&take=200` : null);

  async function bloquear(loteId: string, blocked: boolean) {
    const notas = blocked ? await pedirTexto({ titulo: t('bloquearTitulo'), mensaje: t('bloquearMensaje'), placeholder: t('bloquearEjemplo') }) : '';
    if (notas === null) return;
    try {
      await api.patch(`/api/inventario/lotes/${loteId}`, { blocked, notes: notas || null });
      onCambio();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function trazar(loteId: string) {
    try {
      setTraza(await api.get<Traza>(`/api/inventario/lotes/${loteId}`));
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function corregir(m: Movimiento) {
    const motivo = await pedirTexto({ titulo: t('corregirTitulo'), mensaje: t('corregirMensaje'), placeholder: t('corregirEjemplo') });
    if (motivo === null) return;
    try {
      await api.patch('/api/inventario/movimientos', { id: m.id, motivo });
      movs.recargar();
      onCambio();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function archivar() {
    if (!producto || !(await confirmar({ titulo: t('archivarTitulo'), mensaje: t('archivarMensaje'), aceptar: t('archivar'), peligro: true }))) return;
    try {
      await api.delete(`/api/inventario/${producto.id}`);
      onCambio();
      onCerrar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  const corregible = (m: Movimiento) => !m.corregido && m.reason !== 'CORRECCION' && m.reason !== 'VENTA' && !m.clinicalEntryId && !m.facialEntryId;

  return (
    <Modal abierto={Boolean(producto)} titulo={producto?.name ?? ''} onCerrar={() => { setTraza(null); onCerrar(); }} ancho="max-w-4xl">
      {producto && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-display text-3xl text-brand-900">{fmt.numero(producto.stock, 2)}</span>
              <span className="text-muted">{producto.unit}</span>
              <span className="text-muted">· {t('rinde', { n: fmt.numero(producto.stock * producto.applicationPerUnit, 1), unidad: producto.applicationUnit })}</span>
              {producto.bajo && <Pastilla tono="ambar">{t('bajo')}</Pastilla>}
              {producto.vencido && <Pastilla tono="rojo">{t('vencido')}</Pastilla>}
            </div>
            <div className="flex gap-2">
              {usuario.role !== 'RECEPCION' && (
                <button type="button" onClick={onEditar} className="btn-outline px-4 py-2">
                  <Pencil className="h-4 w-4" aria-hidden />
                  {tc('editar')}
                </button>
              )}
              {usuario.role === 'ADMIN' && producto.active && (
                <button type="button" onClick={archivar} className="btn-outline px-4 py-2 text-red-600">
                  <Archive className="h-4 w-4" aria-hidden />
                  {t('archivar')}
                </button>
              )}
            </div>
          </div>
          {fallo && <CajaError mensaje={fallo} />}
          {traza ? (
            <div className="space-y-3">
              <button type="button" onClick={() => setTraza(null)} className="text-sm font-bold text-muted hover:text-brand-700">
                ← {tc('volver')}
              </button>
              <p className="font-bold">{t('trazaTitulo', { lote: traza.lote.lotNumber })}</p>
              <p className="text-sm text-muted">{t('trazaTexto')}</p>
              {!traza.aplicaciones.length ? (
                <p className="rounded-2xl bg-cream p-4 text-sm text-muted">{t('trazaVacia')}</p>
              ) : (
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {traza.aplicaciones.map((a, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>
                        <Link href={`/admin/clientas/${a.patientId}`} className="font-bold hover:text-brand-600">
                          {a.nombre}
                        </Link>
                        <span className="ms-2 text-muted" dir="ltr">
                          {fmt.telefono(a.telefono)}
                        </span>
                      </span>
                      <span className="text-muted">
                        {fmt.fechaCorta(a.fecha)} · {fmt.numero(a.cantidad, 2)} {a.unidad}
                        {a.enlace && (
                          <Link href={a.enlace} className="ms-2 font-bold text-brand-600 hover:underline">
                            {tc('ver')}
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <Pestanas
                etiqueta={t('secciones')}
                valor={pestana}
                onChange={setPestana}
                opciones={[
                  { valor: 'lotes', texto: t('lotes'), cuenta: producto.lotes.length },
                  { valor: 'movimientos', texto: t('movimientos') },
                ]}
              />
              {pestana === 'lotes' ? (
                !producto.lotes.length ? (
                  <p className="rounded-2xl bg-cream p-4 text-sm text-muted">{t('sinLotes')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead className="bg-cream text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2 text-start">{t('lote')}</th>
                          <th className="px-3 py-2 text-start">{t('vence')}</th>
                          <th className="px-3 py-2 text-end">{t('existencia')}</th>
                          <th className="px-3 py-2 text-end">{t('costo')}</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {producto.lotes.map((l) => (
                          <tr key={l.id} className={l.stock <= 0 ? 'text-muted' : ''}>
                            <td className="px-3 py-2.5 font-bold">
                              {l.lotNumber}
                              {l.blocked && (
                                <Pastilla tono="rojo" className="ms-2">
                                  {t('bloqueado')}
                                </Pastilla>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {l.expiresAt ? fmt.fechaCorta(l.expiresAt) : '—'}
                              {l.vencido ? (
                                <Pastilla tono="rojo" className="ms-2">
                                  {t('vencido')}
                                </Pastilla>
                              ) : l.porVencer ? (
                                <Pastilla tono="ambar" className="ms-2">
                                  {t('porVencer')}
                                </Pastilla>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-end font-bold">{fmt.numero(l.stock, 2)}</td>
                            <td className="px-3 py-2.5 text-end">{fmt.dinero(l.unitCost)}</td>
                            <td className="px-3 py-2.5 text-end">
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={() => trazar(l.id)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-brand-50" title={t('trazar')}>
                                  <Route className="h-3.5 w-3.5" aria-hidden />
                                  {t('trazar')}
                                </button>
                                {usuario.role !== 'RECEPCION' && (
                                  <button type="button" onClick={() => bloquear(l.id, !l.blocked)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-bold hover:bg-brand-50">
                                    <Ban className="h-3.5 w-3.5" aria-hidden />
                                    {l.blocked ? t('desbloquear') : t('bloquear')}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : movs.cargando && !movs.datos ? (
                <Cargando />
              ) : (
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {(movs.datos?.items ?? []).map((m) => {
                    const sale = m.type === 'SALIDA';
                    return (
                      <li key={m.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm ${m.corregido ? 'opacity-50' : ''}`}>
                        <span className="flex items-center gap-2">
                          {sale ? <ArrowUpRight className="h-4 w-4 text-red-500" aria-hidden /> : <ArrowDownLeft className="h-4 w-4 text-emerald-600" aria-hidden />}
                          <span>
                            <b>{tMotivo(m.reason)}</b>
                            <span className="block text-xs text-muted">
                              {fmt.fechaHora(m.occurredAt)}
                              {m.lot ? ` · ${t('lote')} ${m.lot.lotNumber}` : ''}
                              {m.patient ? ` · ${m.patient.fullName}` : ''}
                              {m.createdBy ? ` · ${m.createdBy.fullName}` : ''}
                              {m.notes ? ` · ${m.notes}` : ''}
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <b className={sale ? 'text-red-600' : 'text-emerald-700'} dir="ltr">
                            {sale ? '−' : '+'}
                            {fmt.numero(m.quantity, 3)}
                          </b>
                          {usuario.role === 'ADMIN' && corregible(m) && (
                            <button type="button" onClick={() => corregir(m)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-brand-50" title={t('corregir')} aria-label={t('corregir')}>
                              <Undo2 className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
