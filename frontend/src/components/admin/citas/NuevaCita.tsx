'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { api } from '@/lib/apiClient';
import { IDIOMAS, LISTA_IDIOMAS, localeDeEnum } from '@/lib/idiomas';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import { CATEGORIAS, ORIGENES_CITA, type AppointmentSource } from '@/lib/types';
import { BuscadorClienta, type ClientaElegida } from '../BuscadorClienta';
import { Contactar } from '../Contactar';
import { CajaError, Modal } from '../ui';
import { mensajeDe } from '../useCarga';
import { SelectorHorario } from './SelectorHorario';

export interface InicialCita {
  dia?: string;
  hora?: string;
  clienta?: ClientaElegida | null;
  serviceId?: string;
}

interface Creada {
  id: string;
  telefono: string;
  correo: string | null;
  texto: string;
}

type Props = { abierto: boolean; onCerrar: () => void; onCreada: () => void; inicial?: InicialCita };

/** Se monta al abrir: así cada vez empieza limpia, con lo que traiga `inicial`. */
export function NuevaCita(props: Props) {
  return props.abierto ? <Formulario {...props} /> : null;
}

function Formulario({ abierto, onCerrar, onCreada, inicial }: Props) {
  const t = useTranslations('panel.citas.nuevaCita');
  const tCat = useTranslations('estados.categoria');
  const tOrigen = useTranslations('estados.origen');
  const tc = useTranslations('comun');
  const locale = useLocale() as Locale;
  const fmt = useFormato();
  const { tratamientos } = useTratamientos();

  const [clienta, setClienta] = useState<ClientaElegida | null>(inicial?.clienta ?? null);
  const [suelta, setSuelta] = useState<{ nombre: string; telefono: string; correo: string; crearFicha: boolean } | null>(null);
  const [idioma, setIdioma] = useState<Locale>(inicial?.clienta ? localeDeEnum(inicial.clienta.preferredLocale) : locale);
  const [serviceId, setServiceId] = useState(inicial?.serviceId ?? '');
  const [dia, setDia] = useState(inicial?.dia ?? fmt.hoy());
  const [hora, setHora] = useState<string | null>(inicial?.hora ?? null);
  const [origen, setOrigen] = useState<AppointmentSource>('TELEFONO');
  const [nota, setNota] = useState('');
  const [confirmada, setConfirmada] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<Creada | null>(null);

  function elegirClienta(c: ClientaElegida | null) {
    setClienta(c);
    if (c) {
      setIdioma(localeDeEnum(c.preferredLocale));
      setSuelta(null);
    }
  }

  const puedeGuardar = Boolean(serviceId && hora && (clienta || (suelta && suelta.nombre.trim().length >= 2 && suelta.telefono.trim().length >= 7)));

  async function guardar() {
    if (!puedeGuardar || !hora) return;
    setGuardando(true);
    setError(null);
    try {
      let patientId = clienta?.id;
      let nombre = clienta?.fullName ?? suelta?.nombre ?? '';
      let telefono = clienta?.phone ?? suelta?.telefono ?? '';
      let correo = clienta?.email ?? (suelta?.correo || null);
      if (!clienta && suelta?.crearFicha) {
        const nueva = await api.post<{ id: string; fullName: string; phone: string; email: string | null }>('/api/patients', {
          fullName: suelta.nombre,
          phone: suelta.telefono,
          email: suelta.correo || null,
          preferredLocale: idioma,
        });
        patientId = nueva.id;
        nombre = nueva.fullName;
        telefono = nueva.phone;
        correo = nueva.email;
      }
      const r = await api.post<{ appointment: { id: string } }>('/api/appointments', {
        serviceId,
        contactName: nombre,
        contactPhone: telefono,
        contactEmail: correo ?? '',
        message: nota || undefined,
        fecha: dia,
        hora,
        patientId,
        source: origen,
        locale: idioma,
        confirmada,
      });
      const texto = await api
        .get<{ texto: string; telefono: string }>(`/api/appointments/${r.appointment.id}/recordatorio?tipo=confirmacion`)
        .then((d) => d.texto)
        .catch(() => '');
      setCreada({ id: r.appointment.id, telefono, correo, texto });
      onCreada();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  if (creada) {
    return (
      <Modal
        abierto={abierto}
        titulo={t('lista')}
        onCerrar={onCerrar}
        pie={
          <button type="button" onClick={onCerrar} className="btn-primary">
            {tc('cerrar')}
          </button>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />
          <p className="font-bold">{t('creada')}</p>
          <p className="text-sm text-muted">{t('mandarConfirmacion')}</p>
          {creada.texto && <p className="w-full whitespace-pre-line rounded-2xl bg-cream p-4 text-start text-sm">{creada.texto}</p>}
          <Contactar telefono={creada.telefono} correo={creada.correo} mensaje={creada.texto} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      abierto={abierto}
      titulo={t('titulo')}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="btn-outline">
            {tc('cancelar')}
          </button>
          <button type="button" onClick={guardar} disabled={!puedeGuardar || guardando} className="btn-primary">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t('guardar')}
          </button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {suelta ? (
            <div className="space-y-3 rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{t('clientaNueva')}</p>
                <button type="button" onClick={() => setSuelta(null)} className="text-xs font-bold text-brand-600 hover:underline">
                  {t('buscarOtra')}
                </button>
              </div>
              <input className="field" placeholder={t('nombre')} value={suelta.nombre} onChange={(e) => setSuelta({ ...suelta, nombre: e.target.value })} aria-label={t('nombre')} />
              <input className="field" placeholder={t('telefono')} inputMode="tel" dir="ltr" value={suelta.telefono} onChange={(e) => setSuelta({ ...suelta, telefono: e.target.value })} aria-label={t('telefono')} />
              <input className="field" placeholder={t('correo')} type="email" dir="ltr" value={suelta.correo} onChange={(e) => setSuelta({ ...suelta, correo: e.target.value })} aria-label={t('correo')} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={suelta.crearFicha} onChange={(e) => setSuelta({ ...suelta, crearFicha: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                {t('crearFicha')}
              </label>
            </div>
          ) : (
            <BuscadorClienta
              etiqueta={t('clienta')}
              elegida={clienta}
              onElegir={elegirClienta}
              onNueva={(texto) => setSuelta({ nombre: /\d{4}/.test(texto) ? '' : texto, telefono: /\d{4}/.test(texto) ? texto : '', correo: '', crearFicha: true })}
              autoFocus
            />
          )}

          <div>
            <label className="field-label" htmlFor="nc-idioma">
              {t('idioma')}
            </label>
            <select id="nc-idioma" className="field" value={idioma} onChange={(e) => setIdioma(e.target.value as Locale)}>
              {LISTA_IDIOMAS.map((l) => (
                <option key={l} value={l}>
                  {IDIOMAS[l].nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">{t('idiomaAyuda')}</p>
          </div>

          <div>
            <label className="field-label" htmlFor="nc-servicio">
              {t('tratamiento')}
            </label>
            <select id="nc-servicio" className="field" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">{t('eligeTratamiento')}</option>
              {CATEGORIAS.map((cat) => {
                const deLaCategoria = tratamientos.filter((s) => s.category === cat);
                if (!deLaCategoria.length) return null;
                return (
                  <optgroup key={cat} label={tCat(cat)}>
                    {deLaCategoria.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} · {fmt.duracion(s.durationMin)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="nc-origen">
                {t('origen')}
              </label>
              <select id="nc-origen" className="field" value={origen} onChange={(e) => setOrigen(e.target.value as AppointmentSource)}>
                {ORIGENES_CITA.map((o) => (
                  <option key={o} value={o}>
                    {tOrigen(o)}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-7 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={confirmada} onChange={(e) => setConfirmada(e.target.checked)} className="h-4 w-4 accent-brand-700" />
              {t('confirmada')}
            </label>
          </div>

          <div>
            <label className="field-label" htmlFor="nc-nota">
              {t('nota')} <span className="font-normal text-muted">({tc('opcional')})</span>
            </label>
            <textarea id="nc-nota" className="field min-h-20" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000} />
          </div>
        </div>

        <div>
          <span className="field-label">{t('horario')}</span>
          <SelectorHorario serviceId={serviceId} dia={dia} onDia={(d) => { setDia(d); setHora(null); }} elegido={hora} onElegir={setHora} />
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <CajaError mensaje={error} />
        </div>
      )}
    </Modal>
  );
}
