'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, CheckCheck } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';

interface Aviso {
  id: string;
  gravedad: 'alta' | 'media';
  titulo: string;
  detalle: string;
  href: string;
  claves: string[];
  nuevos: number;
}
interface Avisos {
  items: Aviso[];
  sinLeer: number;
  total: number;
}

const CADA = 5 * 60_000;

/**
 * La campana: lo que hay que mirar hoy (agenda, mensajes, retoques e
 * inventario). El número cuenta solo lo NUEVO; ver `server/services/avisos.ts`.
 */
export function CampanaAvisos({ arriba = false }: { arriba?: boolean }) {
  const t = useTranslations('panel.campana');
  const pathname = usePathname();
  const [datos, setDatos] = useState<Avisos | null>(null);
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    api
      .get<Avisos>('/api/avisos')
      .then(setDatos)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, CADA);
    return () => clearInterval(intervalo);
  }, [cargar, pathname]);

  useEffect(() => {
    if (!abierta) return undefined;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierta(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierta(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierta]);

  async function marcar(claves?: string[]) {
    try {
      setDatos(await api.post<Avisos>('/api/avisos', { claves }));
    } catch {
      /* La campana nunca bloquea: si falla, se queda como estaba. */
    }
  }

  const sinLeer = datos?.sinLeer ?? 0;

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        aria-label={sinLeer > 0 ? t('conNuevos', { n: sinLeer }) : t('titulo')}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink transition-colors hover:bg-brand-50"
      >
        <Bell className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.8} aria-hidden />
        {sinLeer > 0 && (
          <span className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[0.68rem] font-bold text-white ring-2 ring-surface">
            {sinLeer > 99 ? '99+' : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <div
          className={`absolute z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift ${
            arriba ? 'end-0 top-full mt-2' : 'bottom-0 start-full ms-3'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="font-bold">{t('titulo')}</p>
            {sinLeer > 0 && (
              <button type="button" onClick={() => marcar()} className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                {t('marcarTodo')}
              </button>
            )}
          </div>
          {!datos || datos.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t('vacio')}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {datos.items.map((aviso) => (
                <li key={aviso.id}>
                  <Link
                    href={aviso.href}
                    onClick={() => {
                      setAbierta(false);
                      if (aviso.nuevos > 0) void marcar(aviso.claves);
                    }}
                    className="flex gap-3 px-4 py-3 transition-colors hover:bg-brand-50"
                  >
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${aviso.gravedad === 'alta' ? 'bg-red-500' : 'bg-amber-400'} ${aviso.nuevos ? '' : 'opacity-40'}`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className={`block text-sm ${aviso.nuevos ? 'font-bold' : 'font-medium text-ink/80'}`}>{aviso.titulo}</span>
                      <span className="mt-0.5 block text-xs text-muted">{aviso.detalle}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
