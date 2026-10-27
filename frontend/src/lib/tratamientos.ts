'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { api } from './apiClient';
import type { Service } from './types';

type Traducible = { name: string; shortDesc?: string; translations?: Service['translations'] | unknown };

/** El nombre del tratamiento en el idioma del panel (base: español). */
export function nombreTratamiento(s: Traducible | null | undefined, locale: Locale): string {
  if (!s) return '';
  if (locale === 'es') return s.name;
  const tr = (s.translations ?? {}) as Service['translations'];
  return tr?.[locale]?.name?.trim() || tr?.en?.name?.trim() || s.name;
}

let cache: Promise<Service[]> | null = null;

/** El catálogo, pedido una sola vez por pestaña. `refrescar` lo vuelve a pedir. */
export function useTratamientos(soloActivos = true) {
  const locale = useLocale() as Locale;
  const [lista, setLista] = useState<Service[] | null>(null);

  useEffect(() => {
    let vivo = true;
    cache ??= api.get<{ items: Service[] }>('/api/treatments').then((d) => d.items);
    cache
      .then((items) => {
        if (vivo) setLista(items);
      })
      .catch(() => {
        cache = null;
        if (vivo) setLista([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const visibles = (lista ?? []).filter((s) => !soloActivos || s.active).map((s) => ({ ...s, nombre: nombreTratamiento(s, locale) }));
  return { tratamientos: visibles, cargando: lista === null, nombre: (s: Traducible | null | undefined) => nombreTratamiento(s, locale) };
}

export function olvidarTratamientos() {
  cache = null;
}
