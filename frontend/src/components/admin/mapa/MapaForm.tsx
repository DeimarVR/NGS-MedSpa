'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ImageMinus, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { edad, sumarDias } from '@/lib/format';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import type { FaceView, MapaFacial, Producto } from '@/lib/types';
import { useUsuario } from '../AuthGuard';
import { BuscadorClienta, type ClientaElegida } from '../BuscadorClienta';
import { FirmaPad } from '../FirmaPad';
import { SubidaImagen } from '../SubidaImagen';
import { CajaError, Pestanas } from '../ui';
import { mensajeDe } from '../useCarga';
import { Rostro } from './Rostro';
import { ALTO, ANCHO, ZONAS, esZona, zonaCercana } from './zonas';

const KINDS_MAPA = ['TOXINA', 'RELLENO', 'BIOESTIMULADOR', 'SKIN_BOOSTER'];

interface Punto {
  clave: string;
  id?: string;
  view: FaceView;
  x: number;
  y: number;
  zone: string;
  productId: string;
  productName: string;
  lotId: string;
  lotNumber: string;
  expiresAt: string;
  quantity: string;
  unit: string;
  technique: string;
  notes: string;
}

interface Clienta {
  id: string;
  fullName: string;
  phone: string;
  birthDate: string | null;
  allergies?: string | null;
  medications?: string | null;
  pregnancy?: string;
}

let contador = 0;
const nuevaClave = () => `p${Date.now().toString(36)}${(contador += 1)}`;

/** Lotes que se pueden usar, el que vence primero arriba (FEFO). */
function lotesUsables(p: Producto | undefined) {
  return (p?.lotes ?? [])
    .filter((l) => !l.blocked && !l.vencido && l.stock > 0)
    .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999'));
}

export function MapaForm({ existente, citaId, clientaId }: { existente?: MapaFacial; citaId?: string | null; clientaId?: string | null }) {
  const t = useTranslations('panel.mapa');
  const tZona = useTranslations('panel.mapa.zonas');
  const tVista = useTranslations('estados.vista');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const router = useRouter();
  const { usuario } = useUsuario();
  const { tratamientos } = useTratamientos();
  // Una clave por formulario abierto, creada al primer intento de guardar (ver `envioUnico`).
  const claveDeEnvio = useRef<string | null>(null);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [clienta, setClienta] = useState<Clienta | null>(existente ? { ...existente.patient } : null);
  const [fecha, setFecha] = useState(existente?.procedureDate.slice(0, 10) ?? fmt.hoy());
  const [serviceId, setServiceId] = useState(existente?.serviceId ?? '');
  const appointmentId = existente?.appointmentId ?? citaId ?? null;
  const [foto, setFoto] = useState<string | null>(existente?.facePhotoUrl ?? null);
  const [vista, setVista] = useState<FaceView>('FRENTE');
  const [puntos, setPuntos] = useState<Punto[]>(
    () =>
      existente?.entries.map((e) => ({
        clave: e.id,
        id: e.id,
        view: e.view,
        x: e.x,
        y: e.y,
        zone: e.zone,
        productId: e.productId ?? '',
        productName: e.productName,
        lotId: e.lotId ?? '',
        lotNumber: e.lotNumber ?? '',
        expiresAt: e.expiresAt?.slice(0, 10) ?? '',
        quantity: String(e.quantity),
        unit: e.unit,
        technique: e.technique ?? '',
        notes: e.notes ?? '',
      })) ?? [],
  );
  const [activo, setActivo] = useState<string | null>(null);
  const [notas, setNotas] = useState(existente?.notes ?? '');
  const [indicaciones, setIndicaciones] = useState(existente?.aftercare ?? '');
  const [control, setControl] = useState(existente?.nextControl?.slice(0, 10) ?? '');
  const [controlHora, setControlHora] = useState(existente?.nextControlTime ?? '');
  const [controlServicio, setControlServicio] = useState(existente?.nextControlServiceId ?? '');
  const [firmaPro, setFirmaPro] = useState<string | null>(existente?.professionalSignature ?? usuario.signature ?? null);
  const [firmaClienta, setFirmaClienta] = useState<string | null>(existente?.patientSignature ?? null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catálogo de productos con sus lotes (para elegir lote y descontar).
  useEffect(() => {
    api
      .get<{ items: Producto[] }>('/api/inventario')
      .then((d) => setProductos(d.items.filter((p) => p.active && KINDS_MAPA.includes(p.kind))))
      .catch(() => setProductos([]));
  }, []);

  // Datos de partida: la cita (clienta, tratamiento, día) o la clienta.
  useEffect(() => {
    if (existente) return;
    if (citaId) {
      api
        .get<{ appointment: { id: string; startsAt: string; service: { id: string }; patient: { id: string } | null } }>(`/api/appointments/${citaId}`)
        .then(async ({ appointment }) => {
          setServiceId(appointment.service.id);
          setFecha(fmt.diaEnClinica(appointment.startsAt));
          if (appointment.patient) setClienta(await api.get<Clienta>(`/api/patients/${appointment.patient.id}`));
        })
        .catch(() => undefined);
    } else if (clientaId) {
      api
        .get<Clienta>(`/api/patients/${clientaId}`)
        .then(setClienta)
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citaId, clientaId]);

  async function elegirClienta(c: ClientaElegida | null) {
    if (!c) return setClienta(null);
    setClienta(c);
    api
      .get<Clienta>(`/api/patients/${c.id}`)
      .then(setClienta)
      .catch(() => undefined);
  }

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  function agregar(x: number, y: number) {
    const ultimo = puntos[puntos.length - 1];
    const producto = ultimo?.productId ? porId.get(ultimo.productId) : productos.find((p) => p.kind === 'TOXINA');
    const lote = ultimo?.lotId && ultimo.productId === producto?.id ? ultimo : null;
    const primerLote = lotesUsables(producto)[0];
    const nuevo: Punto = {
      clave: nuevaClave(),
      view: vista,
      x: Math.round((x / ANCHO) * 1000) / 10,
      y: Math.round((y / ALTO) * 1000) / 10,
      zone: zonaCercana(vista, x, y),
      productId: producto?.id ?? '',
      productName: producto?.name ?? '',
      lotId: lote?.lotId ?? primerLote?.id ?? '',
      lotNumber: lote?.lotNumber ?? primerLote?.lotNumber ?? '',
      expiresAt: lote?.expiresAt ?? primerLote?.expiresAt?.slice(0, 10) ?? '',
      quantity: ultimo && ultimo.productId === producto?.id ? ultimo.quantity : producto?.kind === 'TOXINA' ? '4' : '0.1',
      unit: producto?.applicationUnit ?? 'U',
      technique: ultimo?.technique ?? '',
      notes: '',
    };
    setPuntos((ps) => [...ps, nuevo]);
    setActivo(nuevo.clave);
  }

  function cambiar(clave: string, cambios: Partial<Punto>) {
    setPuntos((ps) => ps.map((p) => (p.clave === clave ? { ...p, ...cambios } : p)));
  }

  function elegirProducto(clave: string, productId: string) {
    const p = porId.get(productId);
    const lote = lotesUsables(p)[0];
    cambiar(clave, {
      productId,
      productName: p?.name ?? '',
      unit: p?.applicationUnit ?? 'U',
      lotId: lote?.id ?? '',
      lotNumber: lote?.lotNumber ?? '',
      expiresAt: lote?.expiresAt?.slice(0, 10) ?? '',
    });
  }

  const totales = useMemo(() => {
    const suma = new Map<string, { nombre: string; unidad: string; total: number; porUnidad: number; envase: string }>();
    for (const p of puntos) {
      const q = Number(p.quantity) || 0;
      const k = `${p.productId || p.productName}|${p.unit}`;
      const prod = porId.get(p.productId);
      const previo = suma.get(k) ?? { nombre: p.productName || '—', unidad: p.unit, total: 0, porUnidad: prod?.applicationPerUnit ?? 0, envase: prod?.unit ?? '' };
      previo.total = Math.round((previo.total + q) * 1000) / 1000;
      suma.set(k, previo);
    }
    return [...suma.values()];
  }, [puntos, porId]);

  const puntosDeLaVista = puntos.map((p, i) => ({ ...p, numero: i + 1 })).filter((p) => p.view === vista);
  const edadClienta = clienta ? edad(clienta.birthDate) : null;

  async function guardar() {
    if (!clienta) return setError(t('faltaClienta'));
    setGuardando(true);
    setError(null);
    claveDeEnvio.current ??= crypto.randomUUID();
    const cuerpo = {
      patientId: clienta.id,
      procedureDate: fecha,
      serviceId: serviceId || null,
      appointmentId,
      patientName: clienta.fullName,
      patientAge: edadClienta,
      patientPhone: clienta.phone,
      facePhotoUrl: foto ?? '',
      notes: notas || null,
      aftercare: indicaciones || null,
      nextControl: control || '',
      nextControlTime: control ? controlHora || '' : '',
      nextControlServiceId: control ? controlServicio || serviceId || null : null,
      professionalSignature: firmaPro,
      patientSignature: firmaClienta,
      entries: puntos.map((p) => ({
        id: p.id ?? null,
        view: p.view,
        x: p.x,
        y: p.y,
        zone: p.zone,
        productId: p.productId || null,
        productName: p.productName || null,
        lotId: p.lotId || null,
        lotNumber: p.lotNumber || null,
        expiresAt: p.expiresAt || '',
        quantity: Number(p.quantity),
        unit: p.unit || 'U',
        technique: p.technique || null,
        notes: p.notes || null,
      })),
      version: existente?.updatedAt ?? null,
      claveDeEnvio: existente ? null : claveDeEnvio.current,
    };
    try {
      const r = existente ? await api.put<MapaFacial>(`/api/clinical-records/${existente.id}`, cuerpo) : await api.post<MapaFacial>('/api/clinical-records', cuerpo);
      const avisos = r.avisos?.length ? `&avisos=${encodeURIComponent(r.avisos.join(' · '))}` : '';
      router.replace(`/admin/mapa-facial/${r.id}?guardado=1${avisos}`);
    } catch (e) {
      setError(mensajeDe(e));
      setGuardando(false);
    }
  }

  const alertaSalud = clienta && (clienta.allergies || clienta.pregnancy === 'EMBARAZO' || clienta.pregnancy === 'LACTANCIA');
  const enControl = tratamientos.filter((s) => ['TOXINA', 'RELLENO', 'PERFILADO', 'SIGNATURE', 'VALORACION'].includes(s.category));

  return (
    <div className="space-y-6">
      <section className="card grid gap-4 p-5 sm:p-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          {existente ? (
            <div>
              <span className="field-label">{t('clienta')}</span>
              <p className="rounded-2xl bg-cream px-4 py-3 font-bold">{clienta?.fullName}</p>
            </div>
          ) : (
            <BuscadorClienta etiqueta={t('clienta')} elegida={clienta ? { id: clienta.id, fullName: clienta.fullName, phone: clienta.phone, email: null, preferredLocale: 'EN', birthDate: clienta.birthDate } : null} onElegir={elegirClienta} />
          )}
          {clienta && edadClienta !== null && <p className="mt-1.5 text-xs text-muted">{t('anios', { n: edadClienta })}</p>}
        </div>
        <label className="block">
          <span className="field-label">{t('fecha')}</span>
          <input type="date" className="field" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">{t('tratamiento')}</span>
          <select className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">—</option>
            {tratamientos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        {alertaSalud && (
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 lg:col-span-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              <b>{t('atencion')}</b> {clienta?.allergies}
              {clienta?.pregnancy === 'EMBARAZO' || clienta?.pregnancy === 'LACTANCIA' ? ` · ${t(`embarazo.${clienta.pregnancy}`)}` : ''}
            </p>
          </div>
        )}
        {appointmentId && !existente && <p className="text-xs text-muted lg:col-span-4">{t('desdeCita')}</p>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Pestanas
              etiqueta={t('vista')}
              valor={vista}
              onChange={setVista}
              opciones={(['FRENTE', 'PERFIL_IZQ', 'PERFIL_DER'] as const).map((v) => ({ valor: v, texto: tVista(v), cuenta: puntos.filter((p) => p.view === v).length }))}
            />
          </div>
          <div className="mx-auto max-w-[380px]">
            <Rostro vista={vista} foto={foto} puntos={puntosDeLaVista.map((p) => ({ clave: p.clave, x: p.x, y: p.y, numero: p.numero, kind: porId.get(p.productId)?.kind ?? null, activo: p.clave === activo }))} onTocar={agregar} onPunto={setActivo} etiqueta={t('rostro')} />
          </div>
          <p className="mt-3 text-center text-xs text-muted">{t('ayudaTocar')}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SubidaImagen carpeta="mapas" onSubida={setFoto} texto={foto ? t('cambiarFoto') : t('usarFoto')} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-brand-50" />
            {foto && (
              <button type="button" onClick={() => setFoto(null)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted hover:bg-brand-50">
                <ImageMinus className="h-3.5 w-3.5" aria-hidden />
                {t('quitarFoto')}
              </button>
            )}
          </div>
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">{t('puntos', { n: puntos.length })}</h2>
            <button type="button" onClick={() => agregar(ANCHO / 2, ALTO / 2)} className="btn-ghost px-3 py-1.5">
              <Plus className="h-4 w-4" aria-hidden />
              {t('agregarPunto')}
            </button>
          </div>
          {puntos.length === 0 ? (
            <p className="rounded-2xl bg-cream px-4 py-8 text-center text-sm text-muted">{t('sinPuntos')}</p>
          ) : (
            <ol className="space-y-2">
              {puntos.map((p, i) => {
                const producto = porId.get(p.productId);
                const lotes = lotesUsables(producto);
                const abierto = p.clave === activo;
                return (
                  <li key={p.clave} className={`rounded-2xl border transition-colors ${abierto ? 'border-brand-300 bg-brand-50/40' : 'border-line'}`}>
                    <button type="button" onClick={() => setActivo(abierto ? null : p.clave)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{esZona(p.zone) ? tZona(p.zone) : p.zone}</span>
                        <span className="block truncate text-xs text-muted">
                          {p.productName || t('sinProducto')} · {p.quantity || '0'} {p.unit}
                          {p.lotNumber ? ` · ${t('lote')} ${p.lotNumber}` : ''}
                        </span>
                      </span>
                      <span className="text-xs text-muted">{tVista(p.view)}</span>
                    </button>
                    {abierto && (
                      <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="field-label">{t('zona')}</span>
                          <select className="field py-2" value={esZona(p.zone) ? p.zone : 'otra'} onChange={(e) => cambiar(p.clave, { zone: e.target.value })}>
                            {ZONAS.map((z) => (
                              <option key={z} value={z}>
                                {tZona(z)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="field-label">{t('producto')}</span>
                          <select className="field py-2" value={p.productId} onChange={(e) => elegirProducto(p.clave, e.target.value)}>
                            <option value="">{t('sinInventario')}</option>
                            {productos.map((prod) => (
                              <option key={prod.id} value={prod.id}>
                                {prod.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!p.productId && (
                          <label className="block sm:col-span-2">
                            <span className="field-label">{t('nombreProducto')}</span>
                            <input className="field py-2" value={p.productName} onChange={(e) => cambiar(p.clave, { productName: e.target.value })} />
                          </label>
                        )}
                        <label className="block">
                          <span className="field-label">{t('lote')}</span>
                          {p.productId ? (
                            <select
                              className="field py-2"
                              value={p.lotId}
                              onChange={(e) => {
                                const l = producto?.lotes.find((x) => x.id === e.target.value);
                                cambiar(p.clave, { lotId: e.target.value, lotNumber: l?.lotNumber ?? '', expiresAt: l?.expiresAt?.slice(0, 10) ?? '' });
                              }}
                            >
                              <option value="">{t('sinLote')}</option>
                              {[...lotes, ...(producto?.lotes.filter((l) => l.id === p.lotId && !lotes.includes(l)) ?? [])].map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.lotNumber}
                                  {l.expiresAt ? ` · ${t('vence')} ${fmt.fechaCorta(l.expiresAt)}` : ''} · {fmt.numero(l.stock, 2)} {producto?.unit}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input className="field py-2" value={p.lotNumber} onChange={(e) => cambiar(p.clave, { lotNumber: e.target.value })} />
                          )}
                        </label>
                        <div className="grid grid-cols-[1fr_5rem] gap-2">
                          <label className="block">
                            <span className="field-label">{t('cantidad')}</span>
                            <input type="number" inputMode="decimal" min={0} step="any" className="field py-2" value={p.quantity} onChange={(e) => cambiar(p.clave, { quantity: e.target.value })} />
                          </label>
                          <label className="block">
                            <span className="field-label">{t('unidad')}</span>
                            <input className="field py-2" value={p.unit} onChange={(e) => cambiar(p.clave, { unit: e.target.value })} />
                          </label>
                        </div>
                        <label className="block">
                          <span className="field-label">{t('tecnica')}</span>
                          <input className="field py-2" list="tecnicas" value={p.technique} onChange={(e) => cambiar(p.clave, { technique: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className="field-label">{t('notaPunto')}</span>
                          <input className="field py-2" value={p.notes} onChange={(e) => cambiar(p.clave, { notes: e.target.value })} />
                        </label>
                        <div className="flex justify-end sm:col-span-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPuntos((ps) => ps.filter((x) => x.clave !== p.clave));
                              setActivo(null);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            {t('quitarPunto')}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          <datalist id="tecnicas">
            {t('tecnicas').split('|').map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          {totales.length > 0 && (
            <div className="mt-4 rounded-2xl bg-cream p-4">
              <p className="mb-2 text-xs font-bold uppercase text-muted">{t('totales')}</p>
              <ul className="space-y-1 text-sm">
                {totales.map((x) => (
                  <li key={`${x.nombre}${x.unidad}`} className="flex justify-between gap-3">
                    <span>{x.nombre}</span>
                    <span className="font-bold">
                      {fmt.numero(x.total, 2)} {x.unidad}
                      {x.porUnidad > 0 && <span className="ms-1 font-normal text-muted">({t('deEnvase', { n: fmt.numero(x.total / x.porUnidad, 2), envase: x.envase })})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="indicaciones" className="field-label mb-0">
              {t('indicaciones')}
            </label>
            <div className="flex gap-1">
              {(['toxina', 'relleno'] as const).map((tipo) => (
                <button key={tipo} type="button" onClick={() => setIndicaciones(t(`plantillas.${tipo}`))} className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-muted hover:bg-brand-50">
                  {t(`usarPlantilla.${tipo}`)}
                </button>
              ))}
            </div>
          </div>
          <textarea id="indicaciones" className="field min-h-36" value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} />
          <p className="mt-1 text-xs text-muted">{t('indicacionesAyuda')}</p>
        </div>
        <label className="block">
          <span className="field-label">{t('notas')}</span>
          <textarea className="field min-h-36" value={notas} onChange={(e) => setNotas(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">{t('notasAyuda')}</span>
        </label>

        <div className="rounded-2xl border border-line p-4 lg:col-span-2">
          <p className="text-sm font-bold">{t('proximoControl')}</p>
          <p className="mb-3 text-xs text-muted">{t('proximoControlAyuda')}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_1.5fr_auto]">
            <input type="date" className="field" value={control} min={fecha} onChange={(e) => setControl(e.target.value)} aria-label={t('fechaControl')} />
            <input type="time" className="field" value={controlHora} onChange={(e) => setControlHora(e.target.value)} disabled={!control} aria-label={t('horaControl')} />
            <select className="field" value={controlServicio} onChange={(e) => setControlServicio(e.target.value)} disabled={!control} aria-label={t('servicioControl')}>
              <option value="">{t('mismoTratamiento')}</option>
              {enControl.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {[14, 90].map((d) => (
                <button key={d} type="button" onClick={() => setControl(sumarDias(fecha, d))} className="rounded-full border border-line px-3 py-2 text-xs font-bold hover:bg-brand-50">
                  +{d} {t('dias')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="field-label">{t('firmaProfesional')}</p>
          <FirmaPad valor={firmaPro} onCambio={setFirmaPro} alto="h-32" />
        </div>
        <div>
          <p className="field-label">{t('firmaClienta')}</p>
          <FirmaPad valor={firmaClienta} onCambio={setFirmaClienta} alto="h-32" ayuda={t('firmaClientaAyuda')} />
        </div>
      </section>

      {error && <CajaError mensaje={error} />}
      <div className="sticky bottom-4 z-20 flex justify-end gap-2 rounded-full border border-line bg-surface/95 p-2 shadow-lift backdrop-blur">
        <button type="button" onClick={() => router.back()} className="btn-outline">
          {tc('cancelar')}
        </button>
        <button type="button" onClick={guardar} disabled={guardando || !clienta} className="btn-primary">
          {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {t('guardar')}
        </button>
      </div>
    </div>
  );
}
