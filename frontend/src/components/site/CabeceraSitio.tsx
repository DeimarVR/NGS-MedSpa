'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { IDIOMAS, LISTA_IDIOMAS } from '@/lib/idiomas';
import { Icono } from './iconos';

/** Logo de basico.html: la marca en degradado y el nombre al lado. */
export function LogoNgs({ href = '/' }: { href?: string }) {
  const t = useTranslations('sitio.marca');
  return (
    <Link className="logo" href={href} aria-label="NGS MedSpa">
      <span className="mark">NGS</span>
      <span>
        <b>NGS MedSpa</b>
        <small>{t('lema')}</small>
      </span>
    </Link>
  );
}

/**
 * Selector de idioma. En basico.html eran dos botones (ES/EN); con cinco no
 * caben en la cabecera, así que la pastilla muestra el idioma actual y abre
 * la lista. Cada opción va escrita en su propio idioma.
 */
export function SelectorIdioma() {
  const t = useTranslations('sitio.nav');
  const actual = useLocale();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return undefined;
    function fuera(e: MouseEvent) {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div className="lang-sel" ref={caja}>
      <button
        type="button"
        className="lang-btn"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={t('cambiarIdioma')}
        onClick={() => setAbierto((a) => !a)}
      >
        <Icono nombre="globo" tamano={16} />
        <span>{IDIOMAS[actual].corto}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {abierto && (
        <ul className="lang-lista" role="listbox" aria-label={t('cambiarIdioma')}>
          {LISTA_IDIOMAS.map((l) => (
            <li key={l} role="option" aria-selected={l === actual}>
              <Link href={pathname} locale={l} lang={l} className={l === actual ? 'on' : ''} onClick={() => setAbierto(false)}>
                <b>{IDIOMAS[l].corto}</b> {IDIOMAS[l].nombre}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CabeceraSitio({ enLanding = true }: { enLanding?: boolean }) {
  const t = useTranslations('sitio.nav');
  const locale = useLocale();
  const [abierto, setAbierto] = useState(false);
  // En otras páginas (reserva, legales) los anclajes apuntan a la landing, en el mismo idioma.
  const a = (ancla: string) => (enLanding ? `#${ancla}` : `/${locale}#${ancla}`);

  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierto]);

  const enlaces: Array<{ id: string; texto: string; club?: boolean }> = [
    { id: 'inicio', texto: t('inicio') },
    { id: 'servicios', texto: t('tratamientos') },
    { id: 'esencia', texto: t('nosotros') },
    { id: 'club', texto: t('club'), club: true },
    { id: 'faq', texto: t('preguntas') },
    { id: 'contacto', texto: t('contacto') },
  ];

  return (
    <>
      <header>
        <div className="wrap">
          <LogoNgs href={enLanding ? '#inicio' : '/'} />
          <nav>
            {enlaces.map((e) =>
              e.club ? (
                <a key={e.id} href={a(e.id)} className="clubl">
                  <Icono nombre="corona" tamano={18} />
                  <span>{e.texto}</span>
                </a>
              ) : (
                <a key={e.id} href={a(e.id)}>
                  {e.texto}
                </a>
              ),
            )}
          </nav>
          <SelectorIdioma />
          <Link className="btn btn-grad hdr-cta" href="/reservar">
            {t('reservar')}
          </Link>
          <button type="button" className="menu-btn" aria-label={t('abrirMenu')} onClick={() => setAbierto(true)}>
            <Icono nombre="menu" tamano={28} />
          </button>
        </div>
      </header>
      <div className={`mnav${abierto ? ' open' : ''}`} onClick={(e) => (e.target as HTMLElement).closest('a') && setAbierto(false)}>
        <button type="button" className="menu-btn" aria-label={t('cerrarMenu')} onClick={() => setAbierto(false)}>
          <Icono nombre="cerrar" tamano={28} />
        </button>
        {enlaces.slice(1).map((e) => (
          <a key={e.id} href={a(e.id)}>
            {e.texto}
          </a>
        ))}
        <Link href="/reservar">{t('reservar')}</Link>
      </div>
    </>
  );
}
