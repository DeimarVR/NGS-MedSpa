'use client';

import { useEffect, useRef } from 'react';

/**
 * El video de la portada: vertical y sin sonido.
 *
 * React no pinta el atributo `muted` en el HTML del servidor, y sin él varios
 * navegadores se niegan a reproducir solos. Se fuerza al montar.
 */
export function VideoPortada() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void video.play().catch(() => {
      // Si el navegador no deja, queda el póster: no es un error.
    });
  }, []);

  return (
    <video ref={ref} className="hero-vid" autoPlay muted loop playsInline preload="metadata" poster="/media/hero-poster.jpg" aria-hidden="true">
      <source src="/media/hero.mp4" type="video/mp4" />
    </video>
  );
}
