'use client';

import { useMemo } from 'react';
import { useLocale, useTimeZone } from 'next-intl';
import { IDIOMAS } from './idiomas';
import * as f from './format';

/**
 * Los formatos de `format.ts` ya atados al idioma de la pantalla y a la zona
 * de la clínica: `const fmt = useFormato(); fmt.dinero(1250)`.
 */
export function useFormato() {
  const locale = useLocale();
  const zona = useTimeZone() ?? f.ZONA_POR_DEFECTO;
  return useMemo(() => {
    const intl = IDIOMAS[locale].intl;
    return {
      locale,
      intl,
      zona,
      dinero: (c: number | null | undefined, sinCentavos = false) => f.dinero(c, intl, sinCentavos),
      numero: (v: number, d = 2) => f.numero(v, intl, d),
      fechaLarga: (e: string | Date) => f.fechaLarga(e, intl, zona),
      fechaCorta: (e: string | Date) => f.fechaCorta(e, intl, zona),
      fechaHora: (e: string | Date) => f.fechaHora(e, intl, zona),
      fechaHoraLarga: (e: string | Date) => f.fechaHoraLarga(e, intl, zona),
      hora: (e: string | Date) => f.hora(e, intl, zona),
      fechaDia: (c: string | Date, estilo: 'corta' | 'larga' = 'corta') => f.fechaDia(c, intl, estilo),
      relativo: (e: string | Date) => f.relativo(e, intl),
      duracion: (m: number) => f.duracion(m, intl),
      telefono: f.telefono,
      hoy: () => f.hoyEnClinica(zona),
      diaEnClinica: (e: string | Date) => f.diaEnClinica(e, zona),
      horaEnClinica: (e: string | Date) => f.horaEnClinica(e, zona),
    };
  }, [locale, zona]);
}

export type Formato = ReturnType<typeof useFormato>;
