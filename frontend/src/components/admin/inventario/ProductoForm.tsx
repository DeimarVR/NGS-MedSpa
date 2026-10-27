'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { TIPOS_PRODUCTO, type ProductKind, type Producto } from '@/lib/types';
import { CampoDinero } from '../CampoDinero';
import { CajaError, Modal } from '../ui';
import { mensajeDe } from '../useCarga';

/** Sugerencias según el tipo: así crear un Botox no exige saber qué es «unidad de aplicación». */
const SUGERIDO: Record<ProductKind, { unit: string; applicationUnit: string; applicationPerUnit: number }> = {
  TOXINA: { unit: 'vial', applicationUnit: 'U', applicationPerUnit: 100 },
  RELLENO: { unit: 'jeringa', applicationUnit: 'ml', applicationPerUnit: 1 },
  BIOESTIMULADOR: { unit: 'vial', applicationUnit: 'vial', applicationPerUnit: 1 },
  SKIN_BOOSTER: { unit: 'jeringa', applicationUnit: 'ml', applicationPerUnit: 2 },
  INSUMO: { unit: 'unidad', applicationUnit: 'unidad', applicationPerUnit: 1 },
  VENTA: { unit: 'unidad', applicationUnit: 'unidad', applicationPerUnit: 1 },
};
const CON_LOTE: ProductKind[] = ['TOXINA', 'RELLENO', 'BIOESTIMULADOR', 'SKIN_BOOSTER'];

type Props = { abierto: boolean; producto: Producto | null; onCerrar: () => void; onGuardado: () => void };

/** Se monta al abrir: arranca con el producto que se edita o con lo sugerido para una toxina. */
export function ProductoForm(props: Props) {
  return props.abierto ? <Formulario {...props} /> : null;
}

function datosIniciales(producto: Producto | null) {
  return producto
    ? {
        name: producto.name,
        brand: producto.brand ?? '',
        sku: producto.sku ?? '',
        unit: producto.unit,
        applicationUnit: producto.applicationUnit,
        applicationPerUnit: String(producto.applicationPerUnit),
        supplier: producto.supplier ?? '',
        minStock: String(producto.minStock),
        notes: producto.notes ?? '',
        presentation: producto.presentation ?? '',
      }
    : { name: '', brand: '', sku: '', ...SUGERIDO.TOXINA, applicationPerUnit: '100', supplier: '', minStock: '0', notes: '', presentation: '' };
}

function Formulario({ abierto, producto, onCerrar, onGuardado }: Props) {
  const t = useTranslations('panel.inventario.productoForm');
  const tKind = useTranslations('estados.producto');
  const tc = useTranslations('comun');
  const [kind, setKind] = useState<ProductKind>(producto?.kind ?? 'TOXINA');
  const [f, setF] = useState(() => datosIniciales(producto));
  const [precio, setPrecio] = useState<number | null>(producto?.salePrice ?? null);
  const [inicial, setInicial] = useState({ cantidad: '', lotNumber: '', expiresAt: '' });
  const [costo, setCosto] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cambiarKind(k: ProductKind) {
    setKind(k);
    if (!producto) setF((x) => ({ ...x, unit: SUGERIDO[k].unit, applicationUnit: SUGERIDO[k].applicationUnit, applicationPerUnit: String(SUGERIDO[k].applicationPerUnit) }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const cuerpo = {
      ...f,
      kind,
      brand: f.brand || null,
      sku: f.sku || null,
      supplier: f.supplier || null,
      notes: f.notes || null,
      presentation: f.presentation || null,
      applicationPerUnit: Number(f.applicationPerUnit) || 1,
      minStock: Number(f.minStock) || 0,
      salePrice: precio,
      inicial: !producto && Number(inicial.cantidad) > 0 ? { cantidad: Number(inicial.cantidad), lotNumber: inicial.lotNumber || null, expiresAt: inicial.expiresAt || '', unitCost: costo } : null,
    };
    try {
      if (producto) await api.put(`/api/inventario/${producto.id}`, cuerpo);
      else await api.post('/api/inventario', cuerpo);
      onGuardado();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  const campo = (k: keyof typeof f, etiqueta: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="field-label">{etiqueta}</span>
      <input className="field" value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} {...extra} />
    </label>
  );

  return (
    <Modal
      abierto={abierto}
      titulo={producto ? t('editar') : t('nuevo')}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="btn-outline">
            {tc('cancelar')}
          </button>
          <button type="submit" form="form-producto" disabled={guardando} className="btn-primary">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {tc('guardar')}
          </button>
        </>
      }
    >
      <form id="form-producto" onSubmit={guardar} className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_PRODUCTO.map((k) => (
            <button key={k} type="button" onClick={() => cambiarKind(k)} aria-pressed={kind === k} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${kind === k ? 'border-brand-700 bg-brand-700 text-white' : 'border-line hover:bg-brand-50'}`}>
              {tKind(k)}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{campo('name', t('nombre'), { required: true, placeholder: t('nombreEjemplo') })}</div>
          {campo('brand', t('marca'))}
          {campo('sku', t('sku'))}
          {campo('unit', t('envase'), { placeholder: 'vial' })}
          <div className="grid grid-cols-2 gap-2">
            {campo('applicationPerUnit', t('rinde'), { type: 'number', step: 'any', min: 0 })}
            {campo('applicationUnit', t('unidadAplicacion'), { placeholder: 'U' })}
          </div>
          <p className="-mt-2 text-xs text-muted sm:col-span-2">{t('rindeAyuda', { envase: f.unit || '—', n: f.applicationPerUnit || '1', unidad: f.applicationUnit || '—' })}</p>
          {campo('minStock', t('minimo'), { type: 'number', step: 'any', min: 0 })}
          <label className="block">
            <span className="field-label">{t('precioVenta')}</span>
            <CampoDinero valor={precio} onChange={setPrecio} />
          </label>
          {campo('supplier', t('proveedor'))}
          {campo('presentation', t('presentacion'))}
          <label className="block sm:col-span-2">
            <span className="field-label">{t('notas')}</span>
            <textarea className="field min-h-16" value={f.notes} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} />
          </label>
        </div>
        {!producto && (
          <fieldset className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-4">
            <legend className="px-1 text-sm font-bold">{t('existenciaInicial')}</legend>
            <label className="block">
              <span className="field-label">{t('cantidad', { envase: f.unit })}</span>
              <input type="number" step="any" min={0} className="field" value={inicial.cantidad} onChange={(e) => setInicial((x) => ({ ...x, cantidad: e.target.value }))} />
            </label>
            <label className="block">
              <span className="field-label">
                {t('lote')}
                {CON_LOTE.includes(kind) ? ' *' : ''}
              </span>
              <input className="field" value={inicial.lotNumber} onChange={(e) => setInicial((x) => ({ ...x, lotNumber: e.target.value }))} />
            </label>
            <label className="block">
              <span className="field-label">{t('vence')}</span>
              <input type="date" className="field" value={inicial.expiresAt} onChange={(e) => setInicial((x) => ({ ...x, expiresAt: e.target.value }))} />
            </label>
            <label className="block">
              <span className="field-label">{t('costo', { envase: f.unit })}</span>
              <CampoDinero valor={costo} onChange={setCosto} />
            </label>
          </fieldset>
        )}
        {error && <CajaError mensaje={error} />}
      </form>
    </Modal>
  );
}
