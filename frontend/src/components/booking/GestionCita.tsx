'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarCheck2, CalendarX2, Clock, Loader2, MapPin, Phone } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import type { ManagedAppointment } from '@/lib/types';

/** La página del enlace de la clienta: ver su cita, confirmarla o cancelarla. */
export function GestionCita({ token }: { token: string }) {
  const t = useTranslations('publico.cita');
  const fmt = useFormato();
  const [cita, setCita] = useState<ManagedAppointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ahora, setAhora] = useState(0);

  function cargar() {
    api
      .get<ManagedAppointment>(`/api/public/bookings/${token}`)
      .then((c) => {
        setAhora(Date.now());
        setCita(c);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : t('noEncontrada')));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(cargar, [token]);

  async function accion(que: 'confirm' | 'cancel') {
    setTrabajando(true);
    setError(null);
    try {
      await api.post(`/api/public/bookings/${token}/${que}`, que === 'cancel' ? { reason: motivo || undefined } : {});
      setCancelando(false);
      cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('error'));
    } finally {
      setTrabajando(false);
    }
  }

  if (!cita) {
    return (
      <div className="shell py-20 text-center">
        {error ? <p className="mx-auto max-w-md rounded-2xl bg-surface p-6 text-muted shadow-soft">{error}</p> : <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" aria-hidden />}
      </div>
    );
  }

  const futura = new Date(cita.startsAt).getTime() > ahora;
  const viva = (cita.status === 'PENDIENTE' || cita.status === 'CONFIRMADA') && futura;
  const tono = cita.status === 'CONFIRMADA' ? 'bg-emerald-50 text-emerald-700' : cita.status === 'PENDIENTE' ? 'bg-amber-50 text-amber-800' : 'bg-line text-muted';

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-xl">
        <p className="eyebrow">{t('kicker')}</p>
        <h1 className="mt-4 text-4xl text-brand-900">{t('hola', { nombre: cita.contactName.split(' ')[0] })}</h1>
        <div className="mt-6 overflow-hidden rounded-[2rem] bg-surface shadow-soft">
          <div className="bg-brand-900 px-6 py-6 text-white">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tono}`}>{t(`estado.${cita.status}`)}</span>
            <p className="mt-3 font-display text-2xl">{cita.service.name}</p>
          </div>
          <div className="space-y-3 p-6 text-sm">
            <p className="flex items-center gap-3">
              <CalendarCheck2 className="h-5 w-5 text-accent-500" aria-hidden />
              <span className="font-bold">{fmt.fechaDia(fmt.diaEnClinica(cita.startsAt), 'larga')}</span>
            </p>
            <p className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent-500" aria-hidden />
              <bdi dir="ltr">
                {fmt.hora(cita.startsAt)} – {fmt.hora(cita.endsAt)}
              </bdi>
            </p>
            {cita.clinic.address && (
              <p className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-accent-500" aria-hidden />
                {cita.clinic.address}
              </p>
            )}
            {cita.clinic.phone && (
              <p className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-accent-500" aria-hidden />
                <a href={`tel:+1${cita.clinic.phone.replace(/\D/g, '').slice(-10)}`} className="font-bold text-brand-700" dir="ltr">
                  {cita.clinic.phone}
                </a>
              </p>
            )}
          </div>
          {viva && (
            <div className="space-y-3 border-t border-line p-6">
              {cancelando ? (
                <>
                  <p className="text-sm font-bold">{t('seguroCancelar')}</p>
                  <textarea className="field min-h-20" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t('motivo')} maxLength={300} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => accion('cancel')} disabled={trabajando} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700">
                      {trabajando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarX2 className="h-4 w-4" aria-hidden />}
                      {t('siCancelar')}
                    </button>
                    <button type="button" onClick={() => setCancelando(false)} className="btn-ghost">
                      {t('noCancelar')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cita.status === 'PENDIENTE' && (
                    <button type="button" onClick={() => accion('confirm')} disabled={trabajando} className="btn-grad">
                      {trabajando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      {t('confirmar')}
                    </button>
                  )}
                  <button type="button" onClick={() => setCancelando(true)} className="btn-outline">
                    {t('cancelar')}
                  </button>
                </div>
              )}
              <p className="text-xs text-muted">{t('cambiarHora')}</p>
            </div>
          )}
          {cita.status === 'CANCELADA' && (
            <div className="border-t border-line p-6 text-sm">
              <p className="text-muted">{t('cancelada')}</p>
              <Link href="/reservar" className="btn-grad mt-4">
                {t('reservarOtra')}
              </Link>
            </div>
          )}
          {error && <p className="mx-6 mb-6 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
