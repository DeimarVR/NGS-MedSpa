'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Los filtros de cada pantalla viven en la dirección (?vista=semana&dia=…):
 * así un enlace o un «atrás» devuelve exactamente lo que se estaba mirando.
 */
export function useParametros() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const poner = useCallback(
    (cambios: Record<string, string | null | undefined>) => {
      const nuevos = new URLSearchParams(params.toString());
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor === null || valor === undefined || valor === '') nuevos.delete(clave);
        else nuevos.set(clave, valor);
      }
      const q = nuevos.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return { params, poner, leer: (clave: string) => params.get(clave) };
}
