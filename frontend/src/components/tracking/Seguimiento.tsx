'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarDays, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import type { PatientProgress } from '@/lib/types';

/** El enlace privado de la clienta: sus visitas, indicaciones y próximas citas. */
export function Seguimiento({ token }: { token: string }) {
  const t = useTranslations('publico.seguimiento');
  const tEstado = useTranslations('publico.cita.estado');
  const fmt = useFormato();
  const [datos, setDatos] = useState<PatientProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PatientProgress>(`/api/public/tracking/${token}`)
      .then(setDatos)
      .catch((e) => setError(e instanceof ApiError ? e.message : t('error')));
  }, [token, t]);

  if (!datos) {
    return (
      <div className="shell py-20 text-center">
        {error ? <p className="mx-auto max-w-md rounded-2xl bg-surface p-6 text-muted shadow-soft">{error}</p> : <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" aria-hidden />}
      </div>
    );
  }

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">{t('kicker')}</p>
        <h1 className="mt-4 text-4xl text-brand-900 sm:text-5xl">{t('hola', { nombre: datos.patient.firstName })}</h1>
        <p className="mt-3 text-muted">{t('desde', { fecha: fmt.fechaLarga(datos.patient.memberSince) })}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="rounded-[1.75rem] bg-surface p-6 shadow-soft">
            <h2 className="flex items-center gap-2 text-xl">
              <CalendarDays className="h-5 w-5 text-accent-500" aria-hidden />
              {t('proximas')}
            </h2>
            {datos.proximasCitas.length ? (
              <ul className="mt-4 space-y-3">
                {datos.proximasCitas.map((c) => (
                  <li key={c.id}>
                    <Link href={`/cita/${c.manageToken}`} className="block rounded-2xl bg-cream p-4 hover:bg-accent-100/50">
                      <p className="font-bold">{c.serviceName}</p>
                      <p className="text-sm text-muted">
                        {fmt.fechaDia(fmt.diaEnClinica(c.startsAt), 'larga')} · <bdi dir="ltr">{fmt.hora(c.startsAt)}</bdi>
                      </p>
                      <p className="mt-1 text-xs font-bold text-accent-700">{tEstado(c.status)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">{t('sinProximas')}</p>
            )}
            <Link href="/reservar" className="btn-grad mt-5">
              {t('reservar')}
            </Link>
          </section>
          <section className="rounded-[1.75rem] bg-brand-900 p-6 text-white shadow-soft">
            <h2 className="flex items-center gap-2 text-xl text-white">
              <RotateCcw className="h-5 w-5 text-accent-400" aria-hidden />
              {t('retoques')}
            </h2>
            {datos.retoques.length ? (
              <ul className="mt-4 space-y-2">
                {datos.retoques.map((r) => (
                  <li key={r.serviceName} className="flex justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm">
                    <span>{r.serviceName}</span>
                    <span className="font-bold text-accent-300">{fmt.fechaCorta(r.tocaEl)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-on-deep-muted">{t('sinRetoques')}</p>
            )}
            <p className="mt-4 text-xs text-on-deep-muted">{t('retoquesAyuda')}</p>
          </section>
        </div>

        <section className="mt-6 rounded-[1.75rem] bg-surface p-6 shadow-soft">
          <h2 className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-accent-500" aria-hidden />
            {t('visitas')}
          </h2>
          {datos.visitas.length ? (
            <ol className="relative mt-5 space-y-4 border-s-2 border-accent-100 ps-6">
              {datos.visitas.map((v) => (
                <li key={v.id} className="relative">
                  <span className="absolute -start-[1.95rem] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent-500" aria-hidden />
                  <p className="text-xs font-bold uppercase text-muted">{fmt.fechaLarga(v.fecha)}</p>
                  <p className="font-bold">{v.tratamiento}</p>
                  {v.indicaciones && <p className="mt-2 whitespace-pre-line rounded-2xl bg-cream p-4 text-sm">{v.indicaciones}</p>}
                  {v.proximo && <p className="mt-2 text-sm text-accent-700">{t('proximoControl', { fecha: fmt.fechaLarga(v.proximo) })}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted">{t('sinVisitas')}</p>
          )}
        </section>
        <p className="mt-6 text-center text-xs text-muted">{t('privado')}</p>
      </div>
    </div>
  );
}
