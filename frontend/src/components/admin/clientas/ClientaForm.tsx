'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { api } from '@/lib/apiClient';
import { telefono } from '@/lib/format';
import { IDIOMAS, LISTA_IDIOMAS, aLocale } from '@/lib/idiomas';
import { ORIGENES_CLIENTA, type Gender, type Patient, type PregnancyStatus, type ReferralSource } from '@/lib/types';
import { CajaError, Modal } from '../ui';
import { mensajeDe } from '../useCarga';

const GENEROS: Gender[] = ['FEMENINO', 'MASCULINO', 'OTRO', 'NO_DECLARA'];
const EMBARAZO: PregnancyStatus[] = ['NO', 'EMBARAZO', 'LACTANCIA', 'NO_DECLARA'];

interface Formulario {
  fullName: string;
  phone: string;
  email: string;
  birthDate: string;
  gender: Gender;
  preferredLocale: Locale;
  city: string;
  address: string;
  instagram: string;
  referralSource: ReferralSource | '';
  referralNote: string;
  allergies: string;
  medications: string;
  pregnancy: PregnancyStatus;
  medicalNotes: string;
}

function desde(p: Partial<Patient> | null, locale: Locale, nombre?: string): Formulario {
  return {
    fullName: p?.fullName ?? nombre ?? '',
    phone: p?.phone ? telefono(p.phone) : '',
    email: p?.email ?? '',
    birthDate: p?.birthDate ? p.birthDate.slice(0, 10) : '',
    gender: p?.gender ?? 'FEMENINO',
    preferredLocale: p?.preferredLocale ? aLocale(p.preferredLocale) : locale,
    city: p?.city ?? '',
    address: p?.address ?? '',
    instagram: p?.instagram ?? '',
    referralSource: p?.referralSource ?? '',
    referralNote: p?.referralNote ?? '',
    allergies: p?.allergies ?? '',
    medications: p?.medications ?? '',
    pregnancy: p?.pregnancy ?? 'NO_DECLARA',
    medicalNotes: p?.medicalNotes ?? '',
  };
}

type Props = {
  abierto: boolean;
  clienta: Patient | null;
  nombreInicial?: string;
  onCerrar: () => void;
  onGuardada: (p: Patient) => void;
};

/** Crear o editar la ficha de una clienta (se monta al abrir: empieza limpio). */
export function ClientaForm(props: Props) {
  return props.abierto ? <Formulario {...props} /> : null;
}

function Formulario({ abierto, clienta, nombreInicial, onCerrar, onGuardada }: Props) {
  const t = useTranslations('panel.clientas.form');
  const tGen = useTranslations('estados.genero');
  const tEmb = useTranslations('estados.embarazo');
  const tRef = useTranslations('estados.referido');
  const tc = useTranslations('comun');
  const locale = useLocale() as Locale;
  const [f, setF] = useState<Formulario>(() => desde(clienta, locale, nombreInicial));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poner = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const cuerpo = { ...f, email: f.email || null, birthDate: f.birthDate || null, referralSource: f.referralSource || null };
    try {
      const guardada = clienta ? await api.put<Patient>(`/api/patients/${clienta.id}`, cuerpo) : await api.post<Patient>('/api/patients', cuerpo);
      onGuardada(guardada);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  const campo = (k: keyof Formulario, etiqueta: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="field-label">{etiqueta}</span>
      <input className="field" value={f[k] as string} onChange={(e) => poner(k, e.target.value as never)} {...extra} />
    </label>
  );

  return (
    <Modal
      abierto={abierto}
      titulo={clienta ? t('editar') : t('nueva')}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="btn-outline">
            {tc('cancelar')}
          </button>
          <button type="submit" form="form-clienta" disabled={guardando} className="btn-primary">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {tc('guardar')}
          </button>
        </>
      }
    >
      <form id="form-clienta" onSubmit={guardar} className="space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-accent-700 rtl:tracking-normal">{t('contacto')}</legend>
          <div className="sm:col-span-2">{campo('fullName', t('nombre'), { required: true, autoFocus: !clienta })}</div>
          {campo('phone', t('telefono'), { required: true, inputMode: 'tel', dir: 'ltr', placeholder: '(214) 555-0100' })}
          {campo('email', t('correo'), { type: 'email', dir: 'ltr' })}
          <label className="block">
            <span className="field-label">{t('idioma')}</span>
            <select className="field" value={f.preferredLocale} onChange={(e) => poner('preferredLocale', e.target.value as Locale)}>
              {LISTA_IDIOMAS.map((l) => (
                <option key={l} value={l}>
                  {IDIOMAS[l].nombre}
                </option>
              ))}
            </select>
          </label>
          {campo('instagram', t('instagram'), { dir: 'ltr', placeholder: '@' })}
          {campo('birthDate', t('nacimiento'), { type: 'date' })}
          <label className="block">
            <span className="field-label">{t('genero')}</span>
            <select className="field" value={f.gender} onChange={(e) => poner('gender', e.target.value as Gender)}>
              {GENEROS.map((g) => (
                <option key={g} value={g}>
                  {tGen(g)}
                </option>
              ))}
            </select>
          </label>
          {campo('city', t('ciudad'))}
          {campo('address', t('direccion'))}
          <label className="block">
            <span className="field-label">{t('comoNosConocio')}</span>
            <select className="field" value={f.referralSource} onChange={(e) => poner('referralSource', e.target.value as ReferralSource | '')}>
              <option value="">—</option>
              {ORIGENES_CLIENTA.map((o) => (
                <option key={o} value={o}>
                  {tRef(o)}
                </option>
              ))}
            </select>
          </label>
          {campo('referralNote', t('referidaPor'))}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-bold uppercase tracking-wide text-accent-700 rtl:tracking-normal">{t('salud')}</legend>
          <label className="block sm:col-span-2">
            <span className="field-label">{t('alergias')}</span>
            <textarea className="field min-h-16" value={f.allergies} onChange={(e) => poner('allergies', e.target.value)} />
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">{t('medicamentos')}</span>
            <textarea className="field min-h-16" value={f.medications} onChange={(e) => poner('medications', e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">{t('embarazo')}</span>
            <select className="field" value={f.pregnancy} onChange={(e) => poner('pregnancy', e.target.value as PregnancyStatus)}>
              {EMBARAZO.map((g) => (
                <option key={g} value={g}>
                  {tEmb(g)}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">{t('antecedentes')}</span>
            <textarea className="field min-h-24" value={f.medicalNotes} onChange={(e) => poner('medicalNotes', e.target.value)} />
          </label>
        </fieldset>
        {error && <CajaError mensaje={error} />}
      </form>
    </Modal>
  );
}
