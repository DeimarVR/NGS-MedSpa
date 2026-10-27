'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Icono, type NombreIcono } from './iconos';

/**
 * La guía «Encuentra tu tratamiento ideal», de 2 pasos (basico.html).
 * Cada recomendación lleva a la reserva con el tratamiento ya elegido.
 */
const AREAS: Array<{ id: 'rostro' | 'labios' | 'perfil' | 'piel'; icono: NombreIcono; metas: Record<'a' | 'b', string> }> = [
  { id: 'rostro', icono: 'cara', metas: { a: 'toxina-botulinica', b: 'relleno-ojeras' } },
  { id: 'labios', icono: 'labios', metas: { a: 'relleno-labios', b: 'lip-flip' } },
  { id: 'perfil', icono: 'destello', metas: { a: 'rinomodelacion', b: 'menton-mandibula' } },
  { id: 'piel', icono: 'hoja', metas: { a: 'skin-boosters', b: 'peeling-quimico' } },
];

export function GuiaTratamiento() {
  const t = useTranslations('sitio.guia');
  const [area, setArea] = useState<(typeof AREAS)[number] | null>(null);
  const [meta, setMeta] = useState<'a' | 'b' | null>(null);

  function reiniciar() {
    setArea(null);
    setMeta(null);
  }

  if (area && meta) {
    return (
      <div className="qbox" aria-live="polite">
        <div className="kicker">{t('tuRecomendacion')}</div>
        <div className="rec">
          <span className="kicker" style={{ color: 'var(--muted)' }}>
            {t('sugerimos')}
          </span>
          <b>{t(`areas.${area.id}.${meta}.rec`)}</b>
          <p>{t(`areas.${area.id}.${meta}.detalle`)}</p>
          <Link className="btn btn-grad" href={{ pathname: '/reservar', query: { servicio: area.metas[meta] } }}>
            {t('reservarValoracion')}
          </Link>
        </div>
        <button type="button" className="btn btn-line" onClick={reiniciar}>
          {t('deNuevo')}
        </button>
      </div>
    );
  }

  if (area) {
    return (
      <div className="qbox" aria-live="polite">
        <div className="kicker">{t('paso2')}</div>
        <h3>{t('pregunta2')}</h3>
        <div className="opts">
          {(['a', 'b'] as const).map((m) => (
            <button key={m} type="button" className="opt" onClick={() => setMeta(m)}>
              <i>
                <Icono nombre={area.icono} tamano={26} />
              </i>
              {t(`areas.${area.id}.${m}.meta`)}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-line" onClick={reiniciar}>
          {t('atras')}
        </button>
      </div>
    );
  }

  return (
    <div className="qbox" aria-live="polite">
      <div className="kicker">{t('paso1')}</div>
      <h3>{t('pregunta1')}</h3>
      <div className="opts">
        {AREAS.map((a) => (
          <button key={a.id} type="button" className="opt" onClick={() => setArea(a)}>
            <i>
              <Icono nombre={a.icono} tamano={26} />
            </i>
            {t(`areas.${a.id}.nombre`)}
          </button>
        ))}
      </div>
    </div>
  );
}
