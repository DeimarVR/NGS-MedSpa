'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import type { PhotoType, RegistroFotos } from '@/lib/types';
import { BuscadorClienta, type ClientaElegida } from '../BuscadorClienta';
import { SubidaImagen } from '../SubidaImagen';
import { CajaError, Modal } from '../ui';
import { mensajeDe } from '../useCarga';

export const ANGULOS = ['frontal', 'perfilIzq', 'perfilDer', 'tresCuartosIzq', 'tresCuartosDer', 'detalle'] as const;
const TIPOS: PhotoType[] = ['ANTES', 'PROGRESO', 'DESPUES'];

interface Foto {
  id?: string;
  url: string;
  type: PhotoType;
  angle: string;
  caption: string;
  takenAt: string;
}

type Props = {
  abierto: boolean;
  registro: RegistroFotos | null;
  clientaInicial?: ClientaElegida | null;
  onCerrar: () => void;
  onGuardado: (r: RegistroFotos) => void;
};

/** Se monta al abrir: arranca con el registro que se edita o vacío. */
export function RegistroForm(props: Props) {
  return props.abierto ? <Formulario {...props} /> : null;
}

function Formulario({ abierto, registro, clientaInicial, onCerrar, onGuardado }: Props) {
  const t = useTranslations('panel.fotos');
  const tTipo = useTranslations('estados.foto');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { tratamientos } = useTratamientos();
  const [clienta, setClienta] = useState<(ClientaElegida & { photoConsent?: boolean }) | null>(
    registro
      ? { id: registro.patient.id, fullName: registro.patient.fullName, phone: registro.patient.phone, email: null, preferredLocale: 'EN', birthDate: null, photoConsent: registro.patient.photoConsent }
      : (clientaInicial ?? null),
  );
  const [titulo, setTitulo] = useState(registro?.title ?? '');
  const [serviceId, setServiceId] = useState(registro?.serviceId ?? '');
  const [notas, setNotas] = useState(registro?.notes ?? '');
  const [autoriza, setAutoriza] = useState(registro?.consentSigned ?? true);
  const [publicable, setPublicable] = useState(registro?.publishable ?? false);
  const [fotos, setFotos] = useState<Foto[]>(
    () => registro?.photos.map((f) => ({ id: f.id, url: f.url, type: f.type, angle: f.angle, caption: f.caption ?? '', takenAt: f.takenAt.slice(0, 10) })) ?? [],
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clienta && clienta.photoConsent === undefined) {
      api
        .get<{ photoConsent: boolean }>(`/api/patients/${clienta.id}`)
        .then((p) => setClienta((c) => (c ? { ...c, photoConsent: p.photoConsent } : c)))
        .catch(() => undefined);
    }
  }, [clienta]);

  const mover = (i: number, d: number) =>
    setFotos((fs) => {
      const copia = [...fs];
      const [x] = copia.splice(i, 1);
      copia.splice(Math.max(0, Math.min(copia.length, i + d)), 0, x);
      return copia;
    });
  const cambiar = (i: number, c: Partial<Foto>) => setFotos((fs) => fs.map((f, j) => (j === i ? { ...f, ...c } : f)));

  async function guardar() {
    if (!clienta) return setError(t('faltaClienta'));
    setGuardando(true);
    setError(null);
    const cuerpo = {
      patientId: clienta.id,
      serviceId: serviceId || null,
      title: titulo,
      notes: notas || null,
      consentSigned: autoriza,
      publishable: publicable,
      fotos: fotos.map((f, i) => ({ id: f.id, url: f.url, type: f.type, angle: f.angle, caption: f.caption || null, takenAt: f.takenAt ? new Date(`${f.takenAt}T12:00:00Z`).toISOString() : undefined, sortOrder: i })),
      version: registro?.updatedAt ?? null,
    };
    try {
      onGuardado(registro ? await api.put<RegistroFotos>(`/api/photo-records/${registro.id}`, cuerpo) : await api.post<RegistroFotos>('/api/photo-records', cuerpo));
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={abierto}
      titulo={registro ? t('editarRegistro') : t('nuevoRegistro')}
      onCerrar={onCerrar}
      ancho="max-w-4xl"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="btn-outline">
            {tc('cancelar')}
          </button>
          <button type="button" onClick={guardar} disabled={guardando || !clienta || titulo.trim().length < 3} className="btn-primary">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {tc('guardar')}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {registro ? (
            <div>
              <span className="field-label">{t('clienta')}</span>
              <p className="rounded-2xl bg-cream px-4 py-3 font-bold">{registro.patient.fullName}</p>
            </div>
          ) : (
            <BuscadorClienta etiqueta={t('clienta')} elegida={clienta} onElegir={setClienta} />
          )}
          <label className="block">
            <span className="field-label">{t('tituloRegistro')}</span>
            <input className="field" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={t('tituloEjemplo')} />
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
          <label className="block">
            <span className="field-label">{t('notas')}</span>
            <input className="field" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border border-line p-3 text-sm">
            <input type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span>{t('autorizaFotos')}</span>
          </label>
          <label className={`flex items-start gap-3 rounded-2xl border p-3 text-sm ${clienta?.photoConsent ? 'border-line' : 'border-dashed border-line opacity-60'}`}>
            <input type="checkbox" disabled={!clienta?.photoConsent} checked={publicable} onChange={(e) => setPublicable(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span>
              {t('publicable')}
              {!clienta?.photoConsent && <span className="block text-xs text-muted">{t('publicableSinConsentimiento')}</span>}
            </span>
          </label>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="field-label mb-0">{t('fotosN', { n: fotos.length })}</p>
            <SubidaImagen carpeta="fotos" multiple onSubida={(url) => setFotos((fs) => [...fs, { url, type: fs.length ? 'DESPUES' : 'ANTES', angle: 'frontal', caption: '', takenAt: fmt.hoy() }])} />
          </div>
          {fotos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{t('sinFotos')}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {fotos.map((f, i) => (
                <li key={f.url} className="flex gap-3 rounded-2xl border border-line p-2.5">
                  <img src={f.url} alt="" className="h-28 w-24 shrink-0 rounded-xl bg-cream object-cover" />
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <select className="field px-2 py-1.5 text-sm" value={f.type} onChange={(e) => cambiar(i, { type: e.target.value as PhotoType })} aria-label={t('tipo')}>
                        {TIPOS.map((x) => (
                          <option key={x} value={x}>
                            {tTipo(x)}
                          </option>
                        ))}
                      </select>
                      <select className="field px-2 py-1.5 text-sm" value={f.angle} onChange={(e) => cambiar(i, { angle: e.target.value })} aria-label={t('angulo')}>
                        {ANGULOS.map((a) => (
                          <option key={a} value={a}>
                            {t(`angulos.${a}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input type="date" className="field px-2 py-1.5 text-sm" value={f.takenAt} onChange={(e) => cambiar(i, { takenAt: e.target.value })} aria-label={t('fecha')} />
                    <div className="flex items-center gap-1">
                      <input className="field min-w-0 flex-1 px-2 py-1.5 text-sm" value={f.caption} onChange={(e) => cambiar(i, { caption: e.target.value })} placeholder={t('descripcion')} />
                      <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-brand-50 disabled:opacity-30" aria-label={t('subirFoto')}>
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button type="button" onClick={() => mover(i, 1)} disabled={i === fotos.length - 1} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-brand-50 disabled:opacity-30" aria-label={t('bajarFoto')}>
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      </button>
                      <button type="button" onClick={() => setFotos((fs) => fs.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('quitar')}>
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && <CajaError mensaje={error} />}
      </div>
    </Modal>
  );
}
