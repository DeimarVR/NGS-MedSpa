'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Icono } from './iconos';

/** Botones flotantes de basico.html: regalo (promoción) y subir. Sin WhatsApp. */
export function Flotantes() {
  const t = useTranslations('sitio.promo');
  const [promo, setPromo] = useState(false);
  const [subir, setSubir] = useState(false);

  useEffect(() => {
    const alMover = () => setSubir(window.scrollY > 600);
    alMover();
    window.addEventListener('scroll', alMover, { passive: true });
    return () => window.removeEventListener('scroll', alMover);
  }, []);

  return (
    <>
      <div className={`promo${promo ? ' open' : ''}`} id="promo" role="dialog" aria-hidden={!promo}>
        <span className="kicker">{t('kicker')}</span>
        <b>{t('titulo')}</b>
        <p>{t('texto')}</p>
        <Link className="btn btn-grad" href={{ pathname: '/reservar', query: { promo: 'bienvenida' } }}>
          {t('boton')}
        </Link>
      </div>
      <button type="button" className="fl gift" aria-label={t('abrir')} aria-expanded={promo} aria-controls="promo" onClick={() => setPromo((p) => !p)}>
        <Icono nombre="regalo" tamano={28} />
      </button>
      <button
        type="button"
        className={`fl top${subir ? ' show' : ''}`}
        aria-label={t('subir')}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <Icono nombre="arriba" tamano={24} />
      </button>
    </>
  );
}
