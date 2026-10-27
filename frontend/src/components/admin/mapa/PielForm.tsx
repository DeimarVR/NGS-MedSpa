'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { edad, sumarDias } from '@/lib/format';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import { FOTOTIPOS, type FichaPiel, type Producto, type SkinType } from '@/lib/types';
import { useUsuario } from '../AuthGuard';
import { BuscadorClienta, type ClientaElegida } from '../BuscadorClienta';
import { FirmaPad } from '../FirmaPad';
import { CajaError } from '../ui';
import { mensajeDe } from '../useCarga';

export const PREOCUPACIONES = ['manchas', 'acne', 'cicatrices', 'poros', 'lineasFinas', 'flacidez', 'deshidratacion', 'rojeces', 'textura', 'ojeras'] as const;
export const ZONAS_PIEL = ['rostro', 'frente', 'mejillas', 'contornoOjos', 'labios', 'cuello', 'escote', 'manos', 'espalda'] as const;

interface Sesion {
  clave: string;
  id?: string;
  sessionDate: string;
  sessionLabel: string;
  serviceId: string;
  zones: string[];
  productId: string;
  productName: string;
  lotId: string;
  lotNumber: string;
  quantity: string;
  quantityUnit: string;
  technique: string;
  findings: string;
  homeCare: string;
  nextControl: string;
  nextControlTime: string;
  nextControlServiceId: string;
  professionalSignature: string | null;
  patientSignature: string | null;
}

interface Clienta {
  id: string;
  fullName: string;
  phone: string;
  birthDate: string | null;
  allergies?: string | null;
}

let contador = 0;
const clave = () => `s${(contador += 1)}`;

function Chips({ opciones, valor, onChange, texto }: { opciones: readonly string[]; valor: string[]; onChange: (v: string[]) => void; texto: (k: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => {
        const si = valor.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={si}
            onClick={() => onChange(si ? valor.filter((x) => x !== o) : [...valor, o])}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${si ? 'border-accent-500 bg-accent-100 text-accent-700' : 'border-line text-muted hover:bg-brand-50'}`}
          >
            {texto(o)}
          </button>
        );
      })}
    </div>
  );
}

export function PielForm({ existente, citaId, clientaId }: { existente?: FichaPiel; citaId?: string | null; clientaId?: string | null }) {
  const t = useTranslations('panel.piel');
  const tFoto = useTranslations('estados.fototipo');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const router = useRouter();
  const { usuario } = useUsuario();
  const { tratamientos } = useTratamientos();
  const claveDeEnvio = useRef<string | null>(null);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [clienta, setClienta] = useState<Clienta | null>(existente ? { ...existente.patient, birthDate: null } : null);
  const [abierta, setAbierta] = useState(existente?.openedAt.slice(0, 10) ?? fmt.hoy());
  const [fototipo, setFototipo] = useState<SkinType | ''>(existente?.skinType ?? '');
  const [estado, setEstado] = useState(existente?.skinCondition ?? '');
  const [preocupaciones, setPreocupaciones] = useState<string[]>(existente?.concerns ?? []);
  const [alergias, setAlergias] = useState(existente?.allergies ?? '');
  const [contra, setContra] = useState(existente?.contraindications ?? '');
  const [notas, setNotas] = useState(existente?.notes ?? '');
  const nuevaSesion = (serviceId = '', fecha = fmt.hoy(), n = 1): Sesion => ({
    clave: clave(),
    sessionDate: fecha,
    sessionLabel: t('sesionN', { n }),
    serviceId,
    zones: ['rostro'],
    productId: '',
    productName: '',
    lotId: '',
    lotNumber: '',
    quantity: '',
    quantityUnit: '',
    technique: '',
    findings: '',
    homeCare: '',
    nextControl: '',
    nextControlTime: '',
    nextControlServiceId: '',
    professionalSignature: usuario.signature ?? null,
    patientSignature: null,
  });
  const [sesiones, setSesiones] = useState<Sesion[]>(
    () =>
      existente?.entries.map((e) => ({
        clave: e.id,
        id: e.id,
        sessionDate: e.sessionDate.slice(0, 10),
        sessionLabel: e.sessionLabel ?? '',
        serviceId: e.serviceId ?? '',
        zones: e.zones,
        productId: e.productId ?? '',
        productName: e.productName ?? '',
        lotId: e.lotId ?? '',
        lotNumber: e.lotNumber ?? '',
        quantity: e.quantity === null ? '' : String(e.quantity),
        quantityUnit: e.quantityUnit ?? '',
        technique: e.technique ?? '',
        findings: e.findings ?? '',
        homeCare: e.homeCare ?? '',
        nextControl: e.nextControl?.slice(0, 10) ?? '',
        nextControlTime: e.nextControlTime ?? '',
        nextControlServiceId: e.nextControlServiceId ?? '',
        professionalSignature: e.professionalSignature,
        patientSignature: e.patientSignature,
      })) ?? (citaId ? [] : [nuevaSesion()]),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    api
      .get<{ items: Producto[] }>('/api/inventario')
      .then((d) => setProductos(d.items.filter((p) => p.active && p.kind !== 'VENTA')))
      .catch(() => setProductos([]));
  }, []);

  useEffect(() => {
    if (existente) return;
    if (citaId) {
      api
        .get<{ appointment: { startsAt: string; service: { id: string }; patient: { id: string } | null } }>(`/api/appointments/${citaId}`)
        .then(async ({ appointment }) => {
          const dia = fmt.diaEnClinica(appointment.startsAt);
          setAbierta(dia);
          setSesiones([nuevaSesion(appointment.service.id, dia, 1)]);
          if (appointment.patient) setClienta(await api.get<Clienta>(`/api/patients/${appointment.patient.id}`));
        })
        .catch(() => undefined);
    } else if (clientaId) {
      api
        .get<Clienta>(`/api/patients/${clientaId}`)
        .then((c) => {
          setClienta(c);
          setAlergias(c.allergies ?? '');
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citaId, clientaId]);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const cambiar = (k: string, c: Partial<Sesion>) => setSesiones((ss) => ss.map((s) => (s.clave === k ? { ...s, ...c } : s)));

  async function elegirClienta(c: ClientaElegida | null) {
    if (!c) return setClienta(null);
    setClienta(c);
    const completa = await api.get<Clienta>(`/api/patients/${c.id}`).catch(() => null);
    if (completa) {
      setClienta(completa);
      if (!alergias) setAlergias(completa.allergies ?? '');
    }
  }

  async function guardar() {
    if (!clienta) return setError(t('faltaClienta'));
    setGuardando(true);
    setError(null);
    claveDeEnvio.current ??= crypto.randomUUID();
    const cuerpo = {
      patientId: clienta.id,
      openedAt: abierta,
      patientName: clienta.fullName,
      patientAge: edad(clienta.birthDate),
      patientPhone: clienta.phone,
      skinType: fototipo || null,
      skinCondition: estado || null,
      concerns: preocupaciones,
      allergies: alergias || null,
      contraindications: contra || null,
      notes: notas || null,
      entries: sesiones.map((s) => ({
        id: s.id,
        sessionDate: s.sessionDate,
        sessionLabel: s.sessionLabel || null,
        serviceId: s.serviceId || null,
        zones: s.zones,
        productId: s.productId || null,
        productName: s.productName || null,
        lotId: s.lotId || null,
        lotNumber: s.lotNumber || null,
        quantity: s.quantity === '' ? null : Number(s.quantity),
        quantityUnit: s.quantityUnit || null,
        technique: s.technique || null,
        findings: s.findings || null,
        homeCare: s.homeCare || null,
        nextControl: s.nextControl || '',
        nextControlTime: s.nextControl ? s.nextControlTime || '' : '',
        nextControlServiceId: s.nextControl ? s.nextControlServiceId || s.serviceId || null : null,
        professionalSignature: s.professionalSignature,
        patientSignature: s.patientSignature,
      })),
      version: existente?.updatedAt ?? null,
      claveDeEnvio: existente ? null : claveDeEnvio.current,
    };
    try {
      const r = existente ? await api.put<FichaPiel>(`/api/facial/${existente.id}`, cuerpo) : await api.post<FichaPiel>('/api/facial', cuerpo);
      const avisos = r.avisos?.length ? `&avisos=${encodeURIComponent(r.avisos.join(' · '))}` : '';
      router.replace(`/admin/mapa-facial/piel/${r.id}?guardado=1${avisos}`);
    } catch (e) {
      setError(mensajeDe(e));
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card grid gap-4 p-5 sm:p-6 lg:grid-cols-4">
        <div className="lg:col-span-2">
          {existente ? (
            <div>
              <span className="field-label">{t('clienta')}</span>
              <p className="rounded-2xl bg-cream px-4 py-3 font-bold">{existente.patientName}</p>
            </div>
          ) : (
            <BuscadorClienta etiqueta={t('clienta')} elegida={clienta ? { id: clienta.id, fullName: clienta.fullName, phone: clienta.phone, email: null, preferredLocale: 'EN', birthDate: clienta.birthDate } : null} onElegir={elegirClienta} />
          )}
        </div>
        <label className="block">
          <span className="field-label">{t('abierta')}</span>
          <input type="date" className="field" value={abierta} onChange={(e) => setAbierta(e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">{t('fototipo')}</span>
          <select className="field" value={fototipo} onChange={(e) => setFototipo(e.target.value as SkinType | '')}>
            <option value="">—</option>
            {FOTOTIPOS.map((f) => (
              <option key={f} value={f}>
                {t('fototipoN', { n: tFoto(f) })}
              </option>
            ))}
          </select>
        </label>
        <label className="block lg:col-span-2">
          <span className="field-label">{t('estado')}</span>
          <input className="field" value={estado} onChange={(e) => setEstado(e.target.value)} placeholder={t('estadoEjemplo')} list="estados-piel" />
          <datalist id="estados-piel">
            {t('estados').split('|').map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </label>
        <div className="lg:col-span-2">
          <span className="field-label">{t('preocupaciones')}</span>
          <Chips opciones={PREOCUPACIONES} valor={preocupaciones} onChange={setPreocupaciones} texto={(k) => t(`preocupacion.${k as (typeof PREOCUPACIONES)[number]}`)} />
        </div>
        <label className="block lg:col-span-2">
          <span className="field-label">{t('alergias')}</span>
          <textarea className="field min-h-16" value={alergias} onChange={(e) => setAlergias(e.target.value)} />
        </label>
        <label className="block lg:col-span-2">
          <span className="field-label">{t('contraindicaciones')}</span>
          <textarea className="field min-h-16" value={contra} onChange={(e) => setContra(e.target.value)} placeholder={t('contraEjemplo')} />
        </label>
        <label className="block lg:col-span-4">
          <span className="field-label">{t('notas')}</span>
          <textarea className="field min-h-16" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
      </section>

      {sesiones.map((s, i) => {
        const producto = porId.get(s.productId);
        const lotes = (producto?.lotes ?? []).filter((l) => (!l.blocked && !l.vencido && l.stock > 0) || l.id === s.lotId);
        return (
          <section key={s.clave} className="card space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-500 text-sm font-bold text-white">{i + 1}</span>
                <input className="field w-48 py-2 font-bold" value={s.sessionLabel} onChange={(e) => cambiar(s.clave, { sessionLabel: e.target.value })} aria-label={t('etiquetaSesion')} />
              </div>
              <button type="button" onClick={() => setSesiones((ss) => ss.filter((x) => x.clave !== s.clave))} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {t('quitarSesion')}
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-4">
              <label className="block">
                <span className="field-label">{t('fecha')}</span>
                <input type="date" className="field" value={s.sessionDate} onChange={(e) => cambiar(s.clave, { sessionDate: e.target.value })} />
              </label>
              <label className="block">
                <span className="field-label">{t('tratamiento')}</span>
                <select className="field" value={s.serviceId} onChange={(e) => cambiar(s.clave, { serviceId: e.target.value })}>
                  <option value="">—</option>
                  {tratamientos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="lg:col-span-2">
                <span className="field-label">{t('zonas')}</span>
                <Chips opciones={ZONAS_PIEL} valor={s.zones} onChange={(v) => cambiar(s.clave, { zones: v })} texto={(k) => t(`zona.${k as (typeof ZONAS_PIEL)[number]}`)} />
              </div>
              <label className="block">
                <span className="field-label">{t('producto')}</span>
                <select
                  className="field"
                  value={s.productId}
                  onChange={(e) => {
                    const p = porId.get(e.target.value);
                    const l = (p?.lotes ?? []).filter((x) => !x.blocked && !x.vencido && x.stock > 0).sort((a, b) => (a.expiresAt ?? '9').localeCompare(b.expiresAt ?? '9'))[0];
                    cambiar(s.clave, { productId: e.target.value, productName: p?.name ?? '', quantityUnit: p?.applicationUnit ?? s.quantityUnit, lotId: l?.id ?? '', lotNumber: l?.lotNumber ?? '' });
                  }}
                >
                  <option value="">{t('sinInventario')}</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">{t('lote')}</span>
                {s.productId ? (
                  <select
                    className="field"
                    value={s.lotId}
                    onChange={(e) => {
                      const l = producto?.lotes.find((x) => x.id === e.target.value);
                      cambiar(s.clave, { lotId: e.target.value, lotNumber: l?.lotNumber ?? '' });
                    }}
                  >
                    <option value="">—</option>
                    {lotes.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.lotNumber} · {fmt.numero(l.stock, 2)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="field" value={s.lotNumber} onChange={(e) => cambiar(s.clave, { lotNumber: e.target.value })} />
                )}
              </label>
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <label className="block">
                  <span className="field-label">{t('cantidad')}</span>
                  <input type="number" step="any" min={0} className="field" value={s.quantity} onChange={(e) => cambiar(s.clave, { quantity: e.target.value })} />
                </label>
                <label className="block">
                  <span className="field-label">{t('unidad')}</span>
                  <input className="field" value={s.quantityUnit} onChange={(e) => cambiar(s.clave, { quantityUnit: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="field-label">{t('tecnica')}</span>
                <input className="field" value={s.technique} onChange={(e) => cambiar(s.clave, { technique: e.target.value })} placeholder={t('tecnicaEjemplo')} />
              </label>
              <label className="block lg:col-span-2">
                <span className="field-label">{t('hallazgos')}</span>
                <textarea className="field min-h-20" value={s.findings} onChange={(e) => cambiar(s.clave, { findings: e.target.value })} />
              </label>
              <label className="block lg:col-span-2">
                <span className="field-label">{t('cuidados')}</span>
                <textarea className="field min-h-20" value={s.homeCare} onChange={(e) => cambiar(s.clave, { homeCare: e.target.value })} />
              </label>
            </div>
            <div className="rounded-2xl border border-line p-4">
              <p className="mb-2 text-sm font-bold">{t('proximoControl')}</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem_1.5fr_auto]">
                <input type="date" className="field" value={s.nextControl} min={s.sessionDate} onChange={(e) => cambiar(s.clave, { nextControl: e.target.value })} aria-label={t('proximoControl')} />
                <input type="time" className="field" value={s.nextControlTime} disabled={!s.nextControl} onChange={(e) => cambiar(s.clave, { nextControlTime: e.target.value })} aria-label={t('hora')} />
                <select className="field" value={s.nextControlServiceId} disabled={!s.nextControl} onChange={(e) => cambiar(s.clave, { nextControlServiceId: e.target.value })} aria-label={t('tratamiento')}>
                  <option value="">{t('mismoTratamiento')}</option>
                  {tratamientos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nombre}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {[21, 28].map((d) => (
                    <button key={d} type="button" onClick={() => cambiar(s.clave, { nextControl: sumarDias(s.sessionDate, d) })} className="rounded-full border border-line px-3 py-2 text-xs font-bold hover:bg-brand-50">
                      +{d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="field-label">{t('firmaProfesional')}</p>
                <FirmaPad valor={s.professionalSignature} onCambio={(v) => cambiar(s.clave, { professionalSignature: v })} alto="h-28" />
              </div>
              <div>
                <p className="field-label">{t('firmaClienta')}</p>
                <FirmaPad valor={s.patientSignature} onCambio={(v) => cambiar(s.clave, { patientSignature: v })} alto="h-28" />
              </div>
            </div>
          </section>
        );
      })}

      <button type="button" onClick={() => setSesiones((ss) => [...ss, nuevaSesion(ss[ss.length - 1]?.serviceId ?? '', fmt.hoy(), ss.length + 1)])} className="btn-outline w-full border-dashed py-4">
        <Plus className="h-4 w-4" aria-hidden />
        {t('agregarSesion')}
      </button>

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
