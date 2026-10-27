'use client';

import { useTranslations } from 'next-intl';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import type { FichaPiel } from '@/lib/types';
import { Dato } from '../ui';
import { PREOCUPACIONES, ZONAS_PIEL } from './PielForm';

export function PielHoja({ ficha }: { ficha: FichaPiel }) {
  const t = useTranslations('panel.piel');
  const tFoto = useTranslations('estados.fototipo');
  const fmt = useFormato();
  const { tratamientos, nombre } = useTratamientos(false);
  const servicio = (id: string | null) => (id ? nombre(tratamientos.find((s) => s.id === id)) : '');
  const zona = (z: string) => ((ZONAS_PIEL as readonly string[]).includes(z) ? t(`zona.${z as (typeof ZONAS_PIEL)[number]}`) : z);
  const preocupacion = (z: string) => ((PREOCUPACIONES as readonly string[]).includes(z) ? t(`preocupacion.${z as (typeof PREOCUPACIONES)[number]}`) : z);

  return (
    <article className="hoja card space-y-6 p-6 sm:p-8">
      <header className="border-b border-line pb-5">
        <p className="eyebrow">{t('hoja')}</p>
        <h1 className="mt-3 text-3xl text-brand-900">{ficha.patientName}</h1>
        <p className="mt-1 text-sm text-muted">{t('abiertaEl', { fecha: fmt.fechaDia(ficha.openedAt.slice(0, 10), 'larga') })}</p>
      </header>
      <dl className="grid gap-4 sm:grid-cols-3">
        <Dato etiqueta={t('fototipo')}>{ficha.skinType ? t('fototipoN', { n: tFoto(ficha.skinType) }) : null}</Dato>
        <Dato etiqueta={t('estado')}>{ficha.skinCondition}</Dato>
        <Dato etiqueta={t('preocupaciones')}>{ficha.concerns.map(preocupacion).join(', ')}</Dato>
        <Dato etiqueta={t('alergias')}>{ficha.allergies}</Dato>
        <Dato etiqueta={t('contraindicaciones')}>{ficha.contraindications}</Dato>
        <Dato etiqueta={t('notas')}>{ficha.notes}</Dato>
      </dl>
      <ol className="space-y-4">
        {ficha.entries.map((s, i) => (
          <li key={s.id} className="rounded-2xl border border-line p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xl text-brand-900">
                {i + 1}. {s.sessionLabel || t('sesionN', { n: i + 1 })}
              </p>
              <p className="text-sm text-muted">{fmt.fechaDia(s.sessionDate.slice(0, 10), 'larga')}</p>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <Dato etiqueta={t('tratamiento')}>{servicio(s.serviceId) || s.service?.name}</Dato>
              <Dato etiqueta={t('zonas')}>{s.zones.map(zona).join(', ')}</Dato>
              <Dato etiqueta={t('producto')}>
                {s.productName}
                {s.quantity !== null ? ` · ${fmt.numero(s.quantity, 2)} ${s.quantityUnit ?? ''}` : ''}
                {s.lotNumber ? ` · ${t('lote')} ${s.lotNumber}` : ''}
              </Dato>
              <Dato etiqueta={t('tecnica')}>{s.technique}</Dato>
              <Dato etiqueta={t('hallazgos')}>{s.findings}</Dato>
              <Dato etiqueta={t('cuidados')}>{s.homeCare}</Dato>
              {s.nextControl && (
                <Dato etiqueta={t('proximoControl')}>
                  {fmt.fechaDia(s.nextControl.slice(0, 10))}
                  {s.nextControlTime ? ` · ${s.nextControlTime}` : ''}
                  {s.nextControlAppointment ? ` · ${t('agendado')}` : ''}
                </Dato>
              )}
            </dl>
            {(s.professionalSignature || s.patientSignature) && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {[
                  [s.professionalSignature, t('firmaProfesional')],
                  [s.patientSignature, t('firmaClienta')],
                ].map(([firma, etiqueta]) => (
                  <div key={etiqueta}>
                    <div className="flex h-16 items-end border-b border-ink/40">{firma && <img src={firma} alt="" className="max-h-16 object-contain" />}</div>
                    <p className="mt-1 text-xs text-muted">{etiqueta}</p>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </article>
  );
}
