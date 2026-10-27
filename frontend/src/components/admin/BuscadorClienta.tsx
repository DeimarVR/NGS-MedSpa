'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Search, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { telefono } from '@/lib/format';

export interface ClientaElegida {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  preferredLocale: string;
  birthDate: string | null;
}

/**
 * Buscador de clientas por nombre, teléfono o correo. Si no aparece, ofrece
 * crearla con lo que se escribió (lo resuelve quien lo usa).
 */
export function BuscadorClienta({
  elegida,
  onElegir,
  onNueva,
  etiqueta,
  autoFocus = false,
}: {
  elegida: ClientaElegida | null;
  onElegir: (c: ClientaElegida | null) => void;
  onNueva?: (texto: string) => void;
  etiqueta?: string;
  autoFocus?: boolean;
}) {
  const t = useTranslations('panel.buscador');
  const id = useId();
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<ClientaElegida[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return undefined;
    const control = new AbortController();
    const espera = setTimeout(() => {
      setBuscando(true);
      api
        .get<{ items: ClientaElegida[] }>(`/api/patients/buscar?q=${encodeURIComponent(q)}`, { signal: control.signal })
        .then((d) => {
          setResultados(d.items);
          setActivo(0);
        })
        .catch(() => undefined)
        .finally(() => setBuscando(false));
    }, 250);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  if (elegida) {
    return (
      <div>
        {etiqueta && <span className="field-label">{etiqueta}</span>}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-brand-900">{elegida.fullName}</p>
            <p className="text-sm text-muted">
              <bdi dir="ltr">{telefono(elegida.phone)}</bdi>
              {elegida.email ? ` · ${elegida.email}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => onElegir(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-white" aria-label={t('cambiar')}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  const opciones = resultados.length + (onNueva && texto.trim().length >= 2 ? 1 : 0);
  function elegir(i: number) {
    if (i < resultados.length) {
      onElegir(resultados[i]);
      setTexto('');
      setAbierto(false);
    } else if (onNueva) {
      onNueva(texto.trim());
      setAbierto(false);
    }
  }

  return (
    <div ref={caja} className="relative">
      {etiqueta && (
        <label htmlFor={id} className="field-label">
          {etiqueta}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={id}
          value={texto}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={abierto && opciones > 0}
          aria-controls={`${id}-lista`}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActivo((a) => Math.min(a + 1, opciones - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActivo((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && abierto && opciones > 0) {
              e.preventDefault();
              elegir(activo);
            }
          }}
          placeholder={t('placeholder')}
          className="field ps-10"
        />
        {buscando && <Loader2 className="absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
      </div>
      {abierto && texto.trim().length >= 2 && (
        <ul id={`${id}-lista`} role="listbox" className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-line bg-surface py-1 shadow-lift">
          {resultados.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === activo}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(i)}
                className={`flex w-full flex-col px-4 py-2.5 text-start ${i === activo ? 'bg-brand-50' : 'hover:bg-brand-50'}`}
              >
                <span className="font-bold">{c.fullName}</span>
                <span className="text-xs text-muted">
                  <bdi dir="ltr">{telefono(c.phone)}</bdi>
                  {c.email ? ` · ${c.email}` : ''}
                </span>
              </button>
            </li>
          ))}
          {!buscando && resultados.length === 0 && <li className="px-4 py-2.5 text-sm text-muted">{t('sinResultados')}</li>}
          {onNueva && (
            <li role="option" aria-selected={activo === resultados.length}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(resultados.length)}
                className={`flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-start text-sm font-bold text-brand-600 ${
                  activo === resultados.length ? 'bg-brand-50' : 'hover:bg-brand-50'
                }`}
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                {t('crear', { nombre: texto.trim() })}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
