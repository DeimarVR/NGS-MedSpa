'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icono } from './iconos';

/** Botón flotante para volver arriba (aparece al bajar). */
export function Flotantes() {
  const t = useTranslations('sitio');
  const [subir, setSubir] = useState(false);

  useEffect(() => {
    const alMover = () => setSubir(window.scrollY > 600);
    alMover();
    window.addEventListener('scroll', alMover, { passive: true });
    return () => window.removeEventListener('scroll', alMover);
  }, []);

  return (
    <button
      type="button"
      className={`fl top${subir ? ' show' : ''}`}
      aria-label={t('subir')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <Icono nombre="arriba" tamano={24} />
    </button>
  );
}
