'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eraser, PenLine, Upload } from 'lucide-react';

const ANCHO_MAXIMO = 600;

/**
 * Firma con el dedo o el mouse (o una foto de la firma en papel). Devuelve un
 * PNG en data URL, que se COPIA en cada documento: si la persona cambia su
 * firma mañana, lo firmado hoy no cambia.
 */
export function FirmaPad({ valor, onCambio, ayuda, alto = 'h-40' }: { valor: string | null; onCambio: (firma: string | null) => void; ayuda?: React.ReactNode; alto?: string }) {
  const t = useTranslations('panel.firma');
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [modo, setModo] = useState<'dibujar' | 'imagen'>(valor ? 'imagen' : 'dibujar');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas || modo !== 'dibujar') return;
    const escala = window.devicePixelRatio || 1;
    const caja = canvas.getBoundingClientRect();
    canvas.width = caja.width * escala;
    canvas.height = caja.height * escala;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f1a2e';
  }, [modo]);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caja.left, y: e.clientY - caja.top };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function trazar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (lienzo.current) onCambio(lienzo.current.toDataURL('image/png'));
  }

  function limpiar() {
    const canvas = lienzo.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onCambio(null);
    setError(null);
    setModo('dibujar');
  }

  function subir(archivo: File) {
    setError(null);
    if (!archivo.type.startsWith('image/')) {
      setError(t('soloImagen'));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, ANCHO_MAXIMO / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d');
        if (!ctx) return setError(t('noSeLeyo'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onCambio(canvas.toDataURL('image/png'));
        setModo('imagen');
      };
      img.onerror = () => setError(t('noSeLeyo'));
      img.src = lector.result as string;
    };
    lector.onerror = () => setError(t('noSeLeyo'));
    lector.readAsDataURL(archivo);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setModo('dibujar');
            if (valor) onCambio(null);
          }}
          aria-pressed={modo === 'dibujar'}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${modo === 'dibujar' ? 'bg-brand-700 text-white' : 'border border-line hover:bg-brand-50'}`}
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden />
          {valor && modo === 'imagen' ? t('otraVez') : t('dibujar')}
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-brand-50">
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {t('subir')}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) subir(archivo);
              e.target.value = '';
            }}
          />
        </label>
        {valor && (
          <button type="button" onClick={limpiar} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-red-50 hover:text-red-600">
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            {t('borrar')}
          </button>
        )}
      </div>
      {modo === 'dibujar' ? (
        <canvas
          ref={lienzo}
          onPointerDown={empezar}
          onPointerMove={trazar}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          aria-label={t('area')}
          className={`${alto} w-full cursor-crosshair touch-none rounded-2xl border border-dashed border-brand-200 bg-white`}
        />
      ) : valor ? (
        <img src={valor} alt={t('firma')} className={`${alto} w-full rounded-2xl border border-line bg-white object-contain p-2`} />
      ) : null}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {ayuda && <p className="mt-2 text-xs text-muted">{ayuda}</p>}
    </div>
  );
}
