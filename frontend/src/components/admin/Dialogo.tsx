'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, MessageCircleQuestion } from 'lucide-react';

/**
 * Las preguntas de «¿seguro?» del panel, sin `window.confirm` (que no se puede
 * traducir ni dar estilo, y que el navegador puede bloquear).
 *
 *   if (await confirmar({ titulo, mensaje, peligro: true })) …
 *   const motivo = await pedirTexto({ titulo, mensaje });
 */
interface Opciones {
  titulo: string;
  mensaje: string;
  aceptar?: string;
  cancelar?: string;
  peligro?: boolean;
}

interface OpcionesDeTexto extends Opciones {
  placeholder?: string;
  obligatorio?: boolean;
}

type Pedido =
  | (Opciones & { tipo: 'confirmar'; resolver: (si: boolean) => void })
  | (OpcionesDeTexto & { tipo: 'texto'; resolver: (texto: string | null) => void });

let mostrar: ((pedido: Pedido) => void) | null = null;

export function confirmar(opciones: Opciones): Promise<boolean> {
  if (!mostrar) return Promise.resolve(window.confirm(`${opciones.titulo}\n\n${opciones.mensaje}`));
  const abrir = mostrar;
  return new Promise((resolver) => abrir({ ...opciones, tipo: 'confirmar', resolver }));
}

export function pedirTexto(opciones: OpcionesDeTexto): Promise<string | null> {
  if (!mostrar) return Promise.resolve(window.prompt(`${opciones.titulo}\n\n${opciones.mensaje}`));
  const abrir = mostrar;
  return new Promise((resolver) => abrir({ ...opciones, tipo: 'texto', resolver }));
}

export function DialogoHost() {
  const t = useTranslations('comun');
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [texto, setTexto] = useState('');
  const botonAceptar = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mostrar = (nuevo) => {
      setTexto('');
      setPedido(nuevo);
    };
    return () => {
      mostrar = null;
    };
  }, []);

  useEffect(() => {
    if (!pedido) return;
    const foco = setTimeout(() => (pedido.tipo === 'texto' ? campo.current : botonAceptar.current)?.focus(), 0);
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        if (pedido.tipo === 'confirmar') pedido.resolver(false);
        else pedido.resolver(null);
        setPedido(null);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      clearTimeout(foco);
      window.removeEventListener('keydown', tecla);
    };
  }, [pedido]);

  if (!pedido) return null;

  function cerrar(acepto: boolean) {
    if (!pedido) return;
    if (pedido.tipo === 'confirmar') pedido.resolver(acepto);
    else pedido.resolver(acepto ? texto.trim() : null);
    setPedido(null);
  }

  const Icono = pedido.peligro ? AlertTriangle : MessageCircleQuestion;
  const falta = pedido.tipo === 'texto' && pedido.obligatorio && !texto.trim();

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dialogo-titulo"
      aria-describedby="dialogo-mensaje"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) cerrar(false);
      }}
    >
      <form
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lift"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!falta) cerrar(true);
        }}
      >
        <div className="flex items-start gap-4">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              pedido.peligro ? 'bg-red-50 text-red-600' : 'bg-brand-100 text-brand-700'
            }`}
          >
            <Icono className="h-5 w-5" strokeWidth={1.9} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="dialogo-titulo" className="text-xl leading-tight">
              {pedido.titulo}
            </h2>
            <p id="dialogo-mensaje" className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
              {pedido.mensaje}
            </p>
            {pedido.tipo === 'texto' && (
              <input
                ref={campo}
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder={pedido.placeholder}
                maxLength={300}
                className="field mt-4"
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => cerrar(false)} className="btn-outline">
            {pedido.cancelar ?? t('cancelar')}
          </button>
          <button
            ref={botonAceptar}
            type="submit"
            disabled={falta}
            className={
              pedido.peligro
                ? 'inline-flex items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50'
                : 'btn-primary'
            }
          >
            {pedido.aceptar ?? t('aceptar')}
          </button>
        </div>
      </form>
    </div>
  );
}
