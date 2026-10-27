'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImageUp, Loader2 } from 'lucide-react';
import { ApiError, api } from '@/lib/apiClient';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Sube una imagen DIRECTO al bucket (URL firmada) y devuelve su ruta interna. */
export async function subirImagen(archivo: File, carpeta: 'fotos' | 'mapas' | 'sitio' | 'sesiones'): Promise<string> {
  const { urlDeSubida, ruta } = await api.post<{ urlDeSubida: string; ruta: string }>('/api/uploads', {
    carpeta,
    contentType: archivo.type,
    size: archivo.size,
  });
  const r = await fetch(urlDeSubida, { method: 'PUT', body: archivo, headers: { 'Content-Type': archivo.type } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ruta;
}

/** Botón para subir una o varias imágenes; cada una llega por `onSubida`. */
export function SubidaImagen({
  carpeta,
  onSubida,
  multiple = false,
  texto,
  className = 'btn-outline px-4 py-2',
}: {
  carpeta: 'fotos' | 'mapas' | 'sitio' | 'sesiones';
  onSubida: (ruta: string) => void;
  multiple?: boolean;
  texto?: string;
  className?: string;
}) {
  const t = useTranslations('panel.subida');
  const entrada = useRef<HTMLInputElement>(null);
  const [avance, setAvance] = useState<{ actual: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivos: File[]) {
    setError(null);
    const buenos = archivos.filter((a) => TIPOS.includes(a.type));
    if (!buenos.length) {
      setError(t('formato'));
      return;
    }
    const fallidos: string[] = [];
    for (const [i, archivo] of buenos.entries()) {
      setAvance({ actual: i + 1, total: buenos.length });
      try {
        onSubida(await subirImagen(archivo, carpeta));
      } catch (e) {
        fallidos.push(archivo.name);
        if (fallidos.length === 1) setError(e instanceof ApiError || e instanceof Error ? e.message : t('fallo'));
      }
    }
    if (buenos.length < archivos.length) setError((x) => [x, t('ignorados', { n: archivos.length - buenos.length })].filter(Boolean).join(' · '));
    setAvance(null);
    if (entrada.current) entrada.current.value = '';
  }

  return (
    <div>
      <button type="button" onClick={() => entrada.current?.click()} disabled={Boolean(avance)} className={className}>
        {avance ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImageUp className="h-4 w-4" aria-hidden />}
        {avance ? (avance.total > 1 ? t('subiendoDe', avance) : t('subiendo')) : (texto ?? (multiple ? t('subirVarias') : t('subir')))}
      </button>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS.join(',')}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const lista = Array.from(e.target.files ?? []);
          if (lista.length) void subir(lista);
        }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
