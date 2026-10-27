'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/apiClient';

interface Estado<T> {
  /** La petición a la que corresponde lo guardado (ruta + vuelta). */
  clave: string;
  datos: T | null;
  error: string | null;
}

/**
 * Pide una ruta GET y lleva la cuenta de cargando / error / datos. Si la ruta
 * cambia mientras la anterior seguía en vuelo, la vieja se cancela: así una
 * respuesta lenta no pisa a la nueva (pasaba al filtrar rápido).
 *
 * «Cargando» no se guarda: se deduce de que lo guardado sea de otra petición.
 * Mientras llega lo nuevo se siguen mostrando los datos anteriores.
 *
 *   const { datos, cargando, error, recargar } = useCarga<T>(`/api/x?y=${y}`);
 */
export function useCarga<T>(ruta: string | null) {
  const [vuelta, setVuelta] = useState(0);
  const [estado, setEstado] = useState<Estado<T>>({ clave: '', datos: null, error: null });
  const clave = ruta ? `${ruta}#${vuelta}` : '';

  useEffect(() => {
    if (!ruta) return undefined;
    const control = new AbortController();
    api
      .get<T>(ruta, { signal: control.signal })
      .then((d) => setEstado({ clave, datos: d, error: null }))
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setEstado((antes) => ({ clave, datos: antes.datos, error: e instanceof ApiError || e instanceof Error ? e.message : String(e) }));
      });
    return () => control.abort();
  }, [ruta, clave]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  const setDatos = useCallback((datos: T) => setEstado((antes) => ({ ...antes, datos })), []);
  return {
    datos: estado.datos,
    setDatos,
    cargando: Boolean(ruta) && estado.clave !== clave,
    error: estado.clave === clave ? estado.error : null,
    recargar,
  };
}

/** El mensaje de un error cualquiera, para mostrarlo. */
export function mensajeDe(error: unknown, porDefecto = ''): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return porDefecto || String(error);
}
