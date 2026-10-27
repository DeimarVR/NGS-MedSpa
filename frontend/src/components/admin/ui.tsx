'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Loader2, Search, X } from 'lucide-react';

/** Título de la pantalla, con su bajada y las acciones a la derecha. */
export function Encabezado({ titulo, bajada, children }: { titulo: string; bajada?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.75rem] leading-tight text-brand-900 sm:text-3xl">{titulo}</h1>
        {bajada && <p className="mt-1.5 max-w-2xl text-sm text-muted">{bajada}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Cargando({ texto, className = '' }: { texto?: string; className?: string }) {
  const t = useTranslations('comun');
  return (
    <div className={`flex items-center justify-center gap-2 py-12 text-sm text-muted ${className}`} role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {texto ?? t('cargando')}
    </div>
  );
}

export function Vacio({ icono, titulo, texto, children }: { icono?: ReactNode; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      {icono && <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-500">{icono}</div>}
      <p className="font-bold text-ink">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{texto}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function CajaError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  const t = useTranslations('comun');
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{mensaje}</p>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="shrink-0 font-bold underline underline-offset-2">
          {t('reintentar')}
        </button>
      )}
    </div>
  );
}

export function CajaOk({ mensaje }: { mensaje: string }) {
  return (
    <div role="status" className="animar-aviso rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {mensaje}
    </div>
  );
}

const TONOS = {
  gris: 'bg-slate-100 text-slate-700',
  azul: 'bg-brand-100 text-brand-700',
  verde: 'bg-emerald-50 text-emerald-700',
  ambar: 'bg-amber-50 text-amber-800',
  rojo: 'bg-red-50 text-red-700',
  oro: 'bg-accent-100 text-accent-700',
} as const;
export type Tono = keyof typeof TONOS;

export function Pastilla({ tono = 'gris', children, className = '' }: { tono?: Tono; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TONOS[tono]} ${className}`}>{children}</span>;
}

/** El color de cada estado de cita, igual en todas las pantallas. */
export const TONO_CITA: Record<string, Tono> = {
  PENDIENTE: 'ambar',
  CONFIRMADA: 'azul',
  COMPLETADA: 'verde',
  NO_ASISTIO: 'rojo',
  CANCELADA: 'gris',
};

export const TONO_RECIBO: Record<string, Tono> = {
  BORRADOR: 'gris',
  EMITIDA: 'ambar',
  PAGADA: 'verde',
  ANULADA: 'gris',
};

export function CampoBusqueda({
  valor,
  onChange,
  placeholder,
  className = '',
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations('comun');
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{placeholder ?? t('buscar')}</span>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('buscar')}
        className="field ps-10"
      />
    </label>
  );
}

/** Pestañas sencillas (botones) con el estado fuera. */
export function Pestanas<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: Array<{ valor: T; texto: string; cuenta?: number }>;
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            o.valor === valor ? 'bg-brand-700 text-white' : 'text-muted hover:bg-brand-50 hover:text-brand-800'
          }`}
        >
          {o.texto}
          {o.cuenta !== undefined && o.cuenta > 0 && (
            <span className={`ms-1.5 rounded-full px-1.5 text-xs ${o.valor === valor ? 'bg-white/20' : 'bg-brand-100 text-brand-700'}`}>{o.cuenta}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Ventana modal: centrada en escritorio, a pantalla completa abajo en el celular. */
export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  ancho = 'max-w-lg',
  pie,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: string;
  pie?: ReactNode;
}) {
  const t = useTranslations('comun');
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    caja.current?.focus();
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={caja}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[92vh] w-full ${ancho} flex-col rounded-t-3xl bg-surface shadow-lift outline-none sm:rounded-3xl`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="text-lg">{titulo}</h2>
          <button type="button" onClick={onCerrar} className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-brand-50" aria-label={t('cerrar')}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {pie && <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{pie}</div>}
      </div>
    </div>
  );
}

/** Un dato con su etiqueta, para fichas de lectura. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted rtl:tracking-normal">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children || '—'}</dd>
    </div>
  );
}

/** Texto en otra dirección (teléfonos, correos, números) dentro de una página RTL. */
export function Ltr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}
