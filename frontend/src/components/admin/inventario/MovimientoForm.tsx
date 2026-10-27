'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import type { Producto, StockMoveReason } from '@/lib/types';
import { BuscadorClienta, type ClientaElegida } from '../BuscadorClienta';
import { CampoDinero } from '../CampoDinero';
import { CajaError, Modal, Pestanas } from '../ui';
import { mensajeDe } from '../useCarga';

type Clase = 'entrada' | 'salida' | 'conteo';
const MOTIVOS: Record<Clase, StockMoveReason[]> = {
  entrada: ['COMPRA', 'DEVOLUCION', 'OTRO'],
  salida: ['USO_EN_PACIENTE', 'VENCIMIENTO', 'DANO', 'OTRO'],
  conteo: ['CONTEO'],
};

/** Entradas (compras), salidas (uso suelto, vencido, dañado) y ajustes por conteo. */
type Props = { abierto: boolean; productos: Producto[]; productoInicial?: Producto | null; onCerrar: () => void; onGuardado: () => void };

export function MovimientoForm(props: Props) {
  return props.abierto ? <Formulario {...props} /> : null;
}

function Formulario({ abierto, productos, productoInicial, onCerrar, onGuardado }: Props) {
  const t = useTranslations('panel.inventario.movimientoForm');
  const tMotivo = useTranslations('estados.motivo');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const [productId, setProductId] = useState(productoInicial?.id ?? '');
  const [clase, setClase] = useState<Clase>('entrada');
  const [motivo, setMotivo] = useState<StockMoveReason>('COMPRA');
  const [sentido, setSentido] = useState<'sobra' | 'falta'>('falta');
  const [cantidad, setCantidad] = useState('');
  const [fecha, setFecha] = useState(fmt.hoy());
  const [lote, setLote] = useState('');
  const [loteNuevo, setLoteNuevo] = useState('');
  const [vence, setVence] = useState('');
  const [costo, setCosto] = useState<number | null>(null);
  const [clienta, setClienta] = useState<ClientaElegida | null>(null);
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const producto = productos.find((p) => p.id === productId);
  const lotes = (producto?.lotes ?? []).filter((l) => l.stock > 0).sort((a, b) => (a.expiresAt ?? '9').localeCompare(b.expiresAt ?? '9'));
  const entra = clase === 'entrada' || (clase === 'conteo' && sentido === 'sobra');

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await api.post('/api/inventario/movimientos', {
        productId,
        type: clase === 'entrada' ? 'ENTRADA' : clase === 'salida' ? 'SALIDA' : sentido === 'sobra' ? 'AJUSTE' : 'SALIDA',
        reason: clase === 'conteo' ? 'CONTEO' : motivo,
        quantity: Number(cantidad.replace(',', '.')),
        fecha,
        hora: fecha === fmt.hoy() ? fmt.horaEnClinica(new Date()) : '12:00',
        patientId: motivo === 'USO_EN_PACIENTE' && clase === 'salida' ? clienta?.id : null,
        lotNumber: entra ? loteNuevo || (lote ? producto?.lotes.find((l) => l.id === lote)?.lotNumber : null) || null : null,
        expiresAt: entra ? vence : '',
        lotId: entra ? null : lote || null,
        unitCost: clase === 'entrada' ? costo : null,
        notes: notas || null,
      });
      onGuardado();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo={t('titulo')}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="btn-outline">
            {tc('cancelar')}
          </button>
          <button type="button" onClick={guardar} disabled={guardando || !productId || !(Number(cantidad.replace(',', '.')) > 0)} className="btn-primary">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {tc('guardar')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="field-label">{t('producto')}</span>
          <select className="field" value={productId} onChange={(e) => { setProductId(e.target.value); setLote(''); }}>
            <option value="">{t('eligeProducto')}</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {fmt.numero(p.stock, 2)} {p.unit}
              </option>
            ))}
          </select>
        </label>
        <Pestanas
          etiqueta={t('tipo')}
          valor={clase}
          onChange={(c) => {
            setClase(c);
            setMotivo(MOTIVOS[c][0]);
          }}
          opciones={[
            { valor: 'entrada', texto: t('entrada') },
            { valor: 'salida', texto: t('salida') },
            { valor: 'conteo', texto: t('conteo') },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {clase === 'conteo' ? (
            <label className="block">
              <span className="field-label">{t('resultadoConteo')}</span>
              <select className="field" value={sentido} onChange={(e) => setSentido(e.target.value as 'sobra' | 'falta')}>
                <option value="falta">{t('falta')}</option>
                <option value="sobra">{t('sobra')}</option>
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="field-label">{t('motivo')}</span>
              <select className="field" value={motivo} onChange={(e) => setMotivo(e.target.value as StockMoveReason)}>
                {MOTIVOS[clase].map((m) => (
                  <option key={m} value={m}>
                    {tMotivo(m)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="field-label">{t('cantidad', { envase: producto?.unit ?? '' })}</span>
            <input className="field" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">{t('fecha')}</span>
            <input type="date" className="field" value={fecha} max={fmt.hoy()} onChange={(e) => setFecha(e.target.value)} />
          </label>
          {entra ? (
            <>
              <label className="block">
                <span className="field-label">{t('lote')}</span>
                <input className="field" value={loteNuevo} onChange={(e) => setLoteNuevo(e.target.value)} list="lotes-producto" placeholder={t('loteEjemplo')} />
                <datalist id="lotes-producto">
                  {producto?.lotes.map((l) => (
                    <option key={l.id} value={l.lotNumber} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="field-label">{t('vence')}</span>
                <input type="date" className="field" value={vence} onChange={(e) => setVence(e.target.value)} />
              </label>
              {clase === 'entrada' && (
                <label className="block">
                  <span className="field-label">{t('costo')}</span>
                  <CampoDinero valor={costo} onChange={setCosto} />
                </label>
              )}
            </>
          ) : (
            <label className="block">
              <span className="field-label">{t('deQueLote')}</span>
              <select className="field" value={lote} onChange={(e) => setLote(e.target.value)}>
                <option value="">{t('sinLote')}</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lotNumber}
                    {l.expiresAt ? ` · ${fmt.fechaCorta(l.expiresAt)}` : ''} · {fmt.numero(l.stock, 2)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {clase === 'salida' && motivo === 'USO_EN_PACIENTE' && <BuscadorClienta etiqueta={t('clienta')} elegida={clienta} onElegir={setClienta} />}
        <label className="block">
          <span className="field-label">{t('notas')}</span>
          <input className="field" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
        {error && <CajaError mensaje={error} />}
      </div>
    </Modal>
  );
}
