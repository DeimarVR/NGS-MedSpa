'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { sumarDias } from '@/lib/format';
import { useFormato } from '@/lib/useFormato';
import type { AvailabilityResponse } from '@/lib/types';
import { Cargando, CajaError } from '../ui';
import { useCarga } from '../useCarga';

/**
 * Los horarios de un día para un tratamiento, como en la reserva en línea pero
 * sin anticipación mínima. El servidor vuelve a comprobar el cupo al guardar.
 */
export function SelectorHorario({
  serviceId,
  dia,
  onDia,
  elegido,
  onElegir,
  excluirCita,
}: {
  serviceId: string;
  dia: string;
  onDia: (d: string) => void;
  elegido: string | null;
  onElegir: (hora: string) => void;
  excluirCita?: string;
}) {
  const t = useTranslations('panel.citas.horario');
  const tMotivo = useTranslations('panel.citas.motivos');
  const fmt = useFormato();
  const { datos, cargando, error, recargar } = useCarga<AvailabilityResponse>(
    serviceId ? `/api/availability?serviceId=${serviceId}&from=${dia}&days=1${excluirCita ? `&excluir=${excluirCita}` : ''}` : null,
  );
  const elDia = datos?.days[0];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => onDia(sumarDias(dia, -1))} className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-brand-50" aria-label={t('anterior')}>
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </button>
        <input type="date" value={dia} onChange={(e) => e.target.value && onDia(e.target.value)} className="field flex-1 py-2" aria-label={t('dia')} />
        <button type="button" onClick={() => onDia(sumarDias(dia, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-line hover:bg-brand-50" aria-label={t('siguiente')}>
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
      <p className="mb-2 text-sm font-bold text-ink">{fmt.fechaDia(dia, 'larga')}</p>
      {!serviceId ? (
        <p className="rounded-2xl bg-cream px-4 py-5 text-center text-sm text-muted">{t('eligeTratamiento')}</p>
      ) : cargando ? (
        <Cargando className="py-6" />
      ) : error ? (
        <CajaError mensaje={error} onReintentar={recargar} />
      ) : !elDia?.open ? (
        <p className="rounded-2xl bg-cream px-4 py-5 text-center text-sm text-muted">{t('cerrado')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {elDia.slots.map((s) => {
            const libre = s.available || s.motivo === 'muy-pronto';
            const activo = elegido === s.time;
            return (
              <button
                key={s.time}
                type="button"
                disabled={!libre}
                onClick={() => onElegir(s.time)}
                title={s.motivo ? tMotivo(s.motivo) : undefined}
                className={`rounded-xl border px-2 py-2 text-sm font-bold transition-colors ${
                  activo
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : libre
                      ? 'border-line bg-surface hover:border-brand-400 hover:bg-brand-50'
                      : 'cursor-not-allowed border-transparent bg-cream text-muted/60 line-through'
                }`}
              >
                <bdi dir="ltr">{fmt.hora(s.startsAt)}</bdi>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
