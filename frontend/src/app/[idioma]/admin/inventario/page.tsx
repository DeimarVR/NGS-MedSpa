'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowLeftRight, FileSpreadsheet, Package, Plus } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import { TIPOS_PRODUCTO, type Producto } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { DetalleProducto } from '@/components/admin/inventario/DetalleProducto';
import { MovimientoForm } from '@/components/admin/inventario/MovimientoForm';
import { ProductoForm } from '@/components/admin/inventario/ProductoForm';
import { CajaError, Cargando, CampoBusqueda, Encabezado, Pastilla, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

interface Datos {
  items: Producto[];
  porVencer: Array<{ id: string; lotNumber: string; expiresAt: string; stock: number; product: { id: string; name: string; unit: string } }>;
  sinPrecio: Array<{ id: string; name: string }>;
}

function Inventario() {
  const t = useTranslations('panel.inventario');
  const tKind = useTranslations('estados.producto');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const { leer, poner } = useParametros();
  const kind = leer('tipo') ?? '';
  const [q, setQ] = useState('');
  const [soloBajos, setSoloBajos] = useState(false);
  const [archivados, setArchivados] = useState(false);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const { datos, cargando, error, recargar } = useCarga<Datos>(
    `/api/inventario?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(q.trim() ? { q: q.trim() } : {}), ...(soloBajos ? { soloBajos: 'true' } : {}), ...(archivados ? { soloArchivados: 'true' } : {}) })}`,
  );
  const productoDetalle = datos?.items.find((p) => p.id === detalle) ?? null;
  const puedeEditar = usuario.role !== 'RECEPCION';
  const valor = (datos?.items ?? []).reduce((s, p) => s + p.lotes.reduce((x, l) => x + Math.max(0, l.stock) * (l.unitCost ?? 0), 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button type="button" onClick={() => api.descargar('/api/inventario/exportar', 'inventario.xlsx').catch((e) => setFallo(mensajeDe(e)))} className="btn-outline">
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Excel
        </button>
        <button type="button" onClick={() => setMoviendo(true)} className="btn-outline">
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          {t('movimiento')}
        </button>
        {puedeEditar && (
          <button type="button" onClick={() => setEditando('nuevo')} className="btn-grad">
            <Plus className="h-4 w-4" aria-hidden />
            {t('nuevoProducto')}
          </button>
        )}
      </Encabezado>

      {datos && (datos.porVencer.length > 0 || datos.sinPrecio.length > 0) && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {datos.porVencer.length > 0 && (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-bold">{t('lotesPorVencer', { n: datos.porVencer.length })}</p>
                <p className="mt-1">
                  {datos.porVencer
                    .slice(0, 4)
                    .map((l) => `${l.product.name} · ${l.lotNumber} (${fmt.fechaCorta(l.expiresAt)})`)
                    .join(' · ')}
                </p>
              </div>
            </div>
          )}
          {datos.sinPrecio.length > 0 && (
            <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              <div>
                <p className="font-bold">{t('sinPrecio', { n: datos.sinPrecio.length })}</p>
                <p className="mt-1 text-muted">{datos.sinPrecio.map((p) => p.name).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {['', ...TIPOS_PRODUCTO].map((k) => (
            <button
              key={k || 'todos'}
              type="button"
              onClick={() => poner({ tipo: k || null })}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold ${kind === k ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-surface hover:bg-brand-50'}`}
            >
              {k ? tKind(k as Producto['kind']) : tc('todos')}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CampoBusqueda valor={q} onChange={setQ} placeholder={t('buscar')} className="sm:w-80" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloBajos} onChange={(e) => setSoloBajos(e.target.checked)} className="h-4 w-4 accent-brand-700" />
            {t('soloBajos')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} className="h-4 w-4 accent-brand-700" />
            {t('archivados')}
          </label>
          {valor > 0 && (
            <p className="text-sm text-muted sm:ms-auto">
              {t('valor')}: <b className="text-ink">{fmt.dinero(valor)}</b>
            </p>
          )}
        </div>
      </div>

      {(error || fallo) && <CajaError mensaje={error ?? fallo ?? ''} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<Package className="h-5 w-5" aria-hidden />} titulo={t('vacio')} texto={t('vacioTexto')} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-cream text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 text-start">{t('producto')}</th>
                  <th className="px-4 py-3 text-start">{t('tipo')}</th>
                  <th className="px-4 py-3 text-end">{t('existencia')}</th>
                  <th className="px-4 py-3 text-start">{t('lotes')}</th>
                  <th className="px-4 py-3 text-end">{t('precio')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {datos.items.map((p) => {
                  const proximo = p.lotes.filter((l) => l.stock > 0 && l.expiresAt).sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''))[0];
                  return (
                    <tr key={p.id} onClick={() => setDetalle(p.id)} className="cursor-pointer hover:bg-brand-50/60">
                      <td className="px-4 py-3">
                        <p className="font-bold">{p.name}</p>
                        <p className="text-xs text-muted">{[p.brand, p.sku].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Pastilla tono="gris">{tKind(p.kind)}</Pastilla>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <span className={`font-bold ${p.stock <= 0 ? 'text-red-600' : p.bajo ? 'text-amber-700' : ''}`}>{fmt.numero(p.stock, 2)}</span>
                        <span className="ms-1 text-muted">{p.unit}</span>
                        {p.bajo && p.stock > 0 && <span className="block text-xs text-amber-700">{t('enMinimo', { n: p.minStock })}</span>}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {p.lotes.filter((l) => l.stock > 0).length || '—'}
                        {proximo && (
                          <span className={`block text-xs ${proximo.vencido ? 'font-bold text-red-600' : proximo.porVencer ? 'font-bold text-amber-700' : ''}`}>
                            {t('vence', { fecha: fmt.fechaCorta(proximo.expiresAt!) })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end">{p.salePrice !== null ? fmt.dinero(p.salePrice) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DetalleProducto
        producto={productoDetalle}
        onCerrar={() => setDetalle(null)}
        onEditar={() => {
          setEditando(productoDetalle);
          setDetalle(null);
        }}
        onCambio={recargar}
      />
      <ProductoForm
        abierto={editando !== null}
        producto={editando === 'nuevo' ? null : editando}
        onCerrar={() => setEditando(null)}
        onGuardado={() => {
          setEditando(null);
          recargar();
        }}
      />
      <MovimientoForm
        abierto={moviendo}
        productos={datos?.items.filter((p) => p.active) ?? []}
        onCerrar={() => setMoviendo(false)}
        onGuardado={() => {
          setMoviendo(false);
          recargar();
        }}
      />
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Inventario />
    </Suspense>
  );
}
