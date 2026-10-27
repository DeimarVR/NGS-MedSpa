'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Package, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { IDIOMAS, aLocale } from '@/lib/idiomas';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import { METODOS_PAGO, type DocumentType, type PaymentMethod, type Producto, type Recibo } from '@/lib/types';
import { useUsuario } from '../AuthGuard';
import { BuscadorClienta, type ClientaElegida } from '../BuscadorClienta';
import { CampoDinero } from '../CampoDinero';
import { CajaError, Pestanas } from '../ui';
import { mensajeDe } from '../useCarga';

interface Linea {
  clave: string;
  quantity: number;
  description: string;
  unitPrice: number | null;
  productId: string | null;
}

const clave = () => Math.random().toString(36).slice(2, 10);
const IDIOMAS_PDF: Locale[] = ['es', 'en', 'fr'];

export function ReciboForm({ existente, citaId, clientaId }: { existente?: Recibo; citaId?: string | null; clientaId?: string | null }) {
  const t = useTranslations('panel.recibos.form');
  const tPago = useTranslations('estados.pago');
  const tc = useTranslations('comun');
  const locale = useLocale() as Locale;
  const fmt = useFormato();
  const router = useRouter();
  const { usuario } = useUsuario();
  const { tratamientos } = useTratamientos();

  const [tipo, setTipo] = useState<DocumentType>(existente?.type ?? 'RECIBO');
  const [fecha, setFecha] = useState(existente?.issueDate.slice(0, 10) ?? fmt.hoy());
  const [clienta, setClienta] = useState<ClientaElegida | null>(null);
  const [nombre, setNombre] = useState(existente?.clientName ?? '');
  const [telefono, setTelefono] = useState(existente?.clientPhone ?? '');
  const [correo, setCorreo] = useState(existente?.clientEmail ?? '');
  const [idioma, setIdioma] = useState<Locale>(existente ? aLocale(existente.locale) : IDIOMAS_PDF.includes(locale) ? locale : 'en');
  const [lineas, setLineas] = useState<Linea[]>(
    existente?.items.map((l) => ({ clave: l.id, quantity: l.quantity, description: l.description, unitPrice: l.unitPrice, productId: l.productId })) ?? [{ clave: clave(), quantity: 1, description: '', unitPrice: null, productId: null }],
  );
  const [descuento, setDescuento] = useState<number | null>(existente?.discount || null);
  const [impuesto, setImpuesto] = useState(existente ? String(existente.taxRateBps / 100) : '');
  const [abono, setAbono] = useState<number | null>(null);
  const [medio, setMedio] = useState<PaymentMethod>('TARJETA');
  const [notas, setNotas] = useState(existente?.notes ?? '');
  const [firmar, setFirmar] = useState(existente ? Boolean(existente.signedBy) : Boolean(usuario.signature));
  const [productos, setProductos] = useState<Producto[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: Producto[] }>('/api/inventario')
      .then((d) => setProductos(d.items.filter((p) => p.active && p.salePrice !== null)))
      .catch(() => setProductos([]));
    if (!existente)
      api
        .get<Record<string, string>>('/api/ajustes')
        .then((a) => setImpuesto((x) => x || String(Number(a.impuestoBps || 0) / 100)))
        .catch(() => undefined);
    if (existente?.patientId)
      api
        .get<ClientaElegida>(`/api/patients/${existente.patientId}`)
        .then(setClienta)
        .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function usarClienta(c: ClientaElegida | null) {
    setClienta(c);
    if (c) {
      setNombre(c.fullName);
      setTelefono(fmt.telefono(c.phone));
      setCorreo(c.email ?? '');
      const suyo = aLocale(c.preferredLocale);
      setIdioma(IDIOMAS_PDF.includes(suyo) ? suyo : 'en');
    }
  }

  useEffect(() => {
    if (existente) return;
    if (citaId) {
      api
        .get<{ appointment: { service: { id: string; name: string }; patient: { id: string } | null; contactName: string; contactPhone: string; contactEmail: string | null } }>(`/api/appointments/${citaId}`)
        .then(async ({ appointment }) => {
          const s = tratamientos.find((x) => x.id === appointment.service.id);
          setLineas([{ clave: clave(), quantity: 1, description: s?.nombre ?? appointment.service.name, unitPrice: s?.priceCents ?? null, productId: null }]);
          if (appointment.patient) usarClienta(await api.get<ClientaElegida>(`/api/patients/${appointment.patient.id}`));
          else {
            setNombre(appointment.contactName);
            setTelefono(fmt.telefono(appointment.contactPhone));
            setCorreo(appointment.contactEmail ?? '');
          }
        })
        .catch(() => undefined);
    } else if (clientaId) {
      api
        .get<ClientaElegida>(`/api/patients/${clientaId}`)
        .then(usarClienta)
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citaId, clientaId, tratamientos.length]);

  const cambiar = (k: string, c: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.clave === k ? { ...l, ...c } : l)));
  const agregar = (l: Partial<Linea> = {}) =>
    setLineas((ls) => {
      const vacia = ls.length === 1 && !ls[0].description && ls[0].unitPrice === null;
      const nueva = { clave: clave(), quantity: 1, description: '', unitPrice: null, productId: null, ...l };
      return vacia ? [nueva] : [...ls, nueva];
    });

  const totales = useMemo(() => {
    const subtotal = lineas.reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0);
    const base = Math.max(0, subtotal - (descuento ?? 0));
    const bps = Math.round((Number(impuesto.replace(',', '.')) || 0) * 100);
    const tax = Math.round((base * bps) / 10_000);
    return { subtotal, base, bps, tax, total: base + tax };
  }, [lineas, descuento, impuesto]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const cuerpo = {
      type: tipo,
      issueDate: fecha,
      patientId: clienta?.id ?? null,
      clientName: nombre,
      clientEmail: correo || '',
      clientPhone: telefono || null,
      locale: idioma,
      items: lineas.filter((l) => l.description.trim()).map((l) => ({ quantity: l.quantity, description: l.description, unitPrice: l.unitPrice ?? 0, productId: l.productId })),
      discount: descuento ?? 0,
      taxRateBps: totales.bps,
      deposit: tipo === 'RECIBO' && !existente ? (abono ?? 0) : 0,
      depositMethod: medio,
      notes: notas || null,
      signature: firmar ? (existente?.signature ?? usuario.signature ?? null) : null,
      signedBy: firmar ? (existente?.signedBy ?? [usuario.fullName, usuario.credentials].filter(Boolean).join(', ')) : null,
    };
    try {
      const r = existente ? await api.put<Recibo>(`/api/invoices/${existente.id}`, cuerpo) : await api.post<Recibo>('/api/invoices', cuerpo);
      router.replace(`/admin/recibos/${r.id}`);
    } catch (e) {
      setError(mensajeDe(e));
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card grid gap-4 p-5 sm:p-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <span className="field-label">{t('tipo')}</span>
          <Pestanas
            etiqueta={t('tipo')}
            valor={tipo}
            onChange={setTipo}
            opciones={[
              { valor: 'RECIBO', texto: t('recibo') },
              { valor: 'COTIZACION', texto: t('cotizacion') },
            ]}
          />
        </div>
        <label className="block">
          <span className="field-label">{t('fecha')}</span>
          <input type="date" className="field" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">{t('idiomaPdf')}</span>
          <select className="field" value={idioma} onChange={(e) => setIdioma(e.target.value as Locale)}>
            {IDIOMAS_PDF.map((l) => (
              <option key={l} value={l}>
                {IDIOMAS[l].nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="lg:col-span-2">
          <BuscadorClienta etiqueta={t('clienta')} elegida={clienta} onElegir={usarClienta} />
          <p className="mt-1 text-xs text-muted">{t('clientaAyuda')}</p>
        </div>
        <label className="block lg:col-span-2">
          <span className="field-label">{t('nombre')}</span>
          <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="block lg:col-span-2">
          <span className="field-label">{t('telefono')}</span>
          <input className="field" dir="ltr" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>
        <label className="block lg:col-span-2">
          <span className="field-label">{t('correo')}</span>
          <input className="field" type="email" dir="ltr" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </label>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">{t('lineas')}</h2>
          <div className="flex flex-wrap gap-2">
            <select
              className="field w-auto py-2 text-sm"
              value=""
              onChange={(e) => {
                const s = tratamientos.find((x) => x.id === e.target.value);
                if (s) agregar({ description: s.nombre, unitPrice: s.priceCents });
              }}
              aria-label={t('agregarTratamiento')}
            >
              <option value="">{t('agregarTratamiento')}</option>
              {tratamientos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                  {s.priceCents ? ` · ${fmt.dinero(s.priceCents)}` : ''}
                </option>
              ))}
            </select>
            {productos.length > 0 && (
              <select
                className="field w-auto py-2 text-sm"
                value=""
                onChange={(e) => {
                  const p = productos.find((x) => x.id === e.target.value);
                  if (p) agregar({ description: p.name, unitPrice: p.salePrice, productId: p.id });
                }}
                aria-label={t('agregarProducto')}
              >
                <option value="">{t('agregarProducto')}</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {fmt.dinero(p.salePrice)} · {t('quedan', { n: fmt.numero(p.stock, 0) })}
                  </option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => agregar()} className="btn-outline px-4 py-2">
              <Plus className="h-4 w-4" aria-hidden />
              {t('lineaLibre')}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_5rem_8rem_8rem_2.5rem] gap-2 px-1 text-xs font-bold uppercase text-muted sm:grid">
            <span>{t('concepto')}</span>
            <span className="text-end">{t('cant')}</span>
            <span className="text-end">{t('precio')}</span>
            <span className="text-end">{t('importe')}</span>
            <span />
          </div>
          {lineas.map((l) => (
            <div key={l.clave} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-line p-2 sm:grid-cols-[1fr_5rem_8rem_8rem_2.5rem] sm:items-center sm:border-0 sm:p-0">
              <div className="relative col-span-2 sm:col-span-1">
                {l.productId && <Package className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent-500" aria-hidden />}
                <input className={`field py-2 ${l.productId ? 'ps-9' : ''}`} value={l.description} onChange={(e) => cambiar(l.clave, { description: e.target.value })} placeholder={t('concepto')} aria-label={t('concepto')} />
              </div>
              <input type="number" min={1} className="field py-2 text-end" value={l.quantity} onChange={(e) => cambiar(l.clave, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} aria-label={t('cant')} />
              <CampoDinero valor={l.unitPrice} onChange={(v) => cambiar(l.clave, { unitPrice: v })} className="field py-2" aria-label={t('precio')} />
              <p className="py-2 text-end font-bold" dir="ltr">
                {fmt.dinero(l.quantity * (l.unitPrice ?? 0))}
              </p>
              <button type="button" onClick={() => setLineas((ls) => (ls.length > 1 ? ls.filter((x) => x.clave !== l.clave) : ls))} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('quitar')}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {productos.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Package className="h-3.5 w-3.5 text-accent-500" aria-hidden />
            {t('productoDescuenta')}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block">
              <span className="field-label">{t('notas')}</span>
              <textarea className="field min-h-24" value={notas} onChange={(e) => setNotas(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={firmar} disabled={!usuario.signature && !existente?.signature} onChange={(e) => setFirmar(e.target.checked)} className="h-4 w-4 accent-brand-700" />
              {usuario.signature || existente?.signature ? t('firmar') : t('sinFirma')}
            </label>
          </div>
          <div className="space-y-3 rounded-2xl bg-cream p-4">
            <div className="flex justify-between text-sm">
              <span>{t('subtotal')}</span>
              <b dir="ltr">{fmt.dinero(totales.subtotal)}</b>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{t('descuento')}</span>
              <div className="w-36">
                <CampoDinero valor={descuento} onChange={setDescuento} className="field bg-surface py-1.5" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{t('impuesto')}</span>
              <div className="flex items-center gap-2">
                <input className="field w-20 bg-surface py-1.5 text-end" inputMode="decimal" dir="ltr" value={impuesto} onChange={(e) => setImpuesto(e.target.value)} aria-label={t('impuesto')} />
                <span>%</span>
                <b className="w-24 text-end" dir="ltr">
                  {fmt.dinero(totales.tax)}
                </b>
              </div>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg">
              <span className="font-bold">{t('total')}</span>
              <b dir="ltr">{fmt.dinero(totales.total)}</b>
            </div>
            {tipo === 'RECIBO' && !existente && (
              <div className="space-y-2 border-t border-line pt-3">
                <p className="text-sm font-bold">{t('abono')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <CampoDinero valor={abono} onChange={setAbono} className="field bg-surface py-2" aria-label={t('abono')} />
                  <select className="field bg-surface py-2" value={medio} onChange={(e) => setMedio(e.target.value as PaymentMethod)} aria-label={t('medio')}>
                    {METODOS_PAGO.map((m) => (
                      <option key={m} value={m}>
                        {tPago(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => setAbono(totales.total)} className="text-xs font-bold text-brand-600 hover:underline">
                  {t('pagaTodo')}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && <CajaError mensaje={error} />}
      <div className="sticky bottom-4 z-20 flex items-center justify-between gap-2 rounded-full border border-line bg-surface/95 p-2 ps-6 shadow-lift backdrop-blur">
        <span className="hidden text-sm text-muted sm:block">
          <Sparkles className="me-1 inline h-4 w-4 text-accent-500" aria-hidden />
          {t('total')}: <b className="text-ink">{fmt.dinero(totales.total)}</b>
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.back()} className="btn-outline">
            {tc('cancelar')}
          </button>
          <button type="button" onClick={guardar} disabled={guardando || nombre.trim().length < 2 || !lineas.some((l) => l.description.trim())} className="btn-primary">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {existente ? tc('guardar') : tipo === 'RECIBO' ? t('emitirRecibo') : t('emitirCotizacion')}
          </button>
        </div>
      </div>
    </div>
  );
}
