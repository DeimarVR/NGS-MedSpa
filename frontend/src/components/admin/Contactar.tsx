'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, Mail, MessageCircle, MessageSquareText, Phone } from 'lucide-react';
import { enlacesDeContacto } from '@/lib/format';

/**
 * Los atajos para escribirle a la clienta desde el teléfono de la clínica.
 *
 * No hay envío automático (el canal está pendiente de decidir): el mensaje ya
 * viene escrito en el idioma de la clienta y aquí se copia o se abre en
 * WhatsApp / SMS / correo con el texto puesto.
 */
export function Contactar({
  telefono,
  correo,
  mensaje,
  asunto,
  compacto = false,
  onUsado,
}: {
  telefono: string;
  correo?: string | null;
  mensaje?: string;
  asunto?: string;
  compacto?: boolean;
  /** Se llama al copiar o abrir un canal (para marcar «avisada»). */
  onUsado?: () => void;
}) {
  const t = useTranslations('comun');
  const [copiado, setCopiado] = useState(false);
  const enlaces = enlacesDeContacto(telefono, mensaje);
  const clase = compacto
    ? 'grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink/80 transition-colors hover:border-brand-300 hover:bg-brand-50'
    : 'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink/80 transition-colors hover:border-brand-300 hover:bg-brand-50';

  async function copiar() {
    if (!mensaje) return;
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
      onUsado?.();
    } catch {
      /* sin portapapeles: queda el botón de WhatsApp */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {mensaje && (
        <button type="button" onClick={copiar} className={clase} title={t('copiar')}>
          {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          <span className={compacto ? 'sr-only' : ''}>{copiado ? t('copiado') : t('copiar')}</span>
        </button>
      )}
      <a href={enlaces.whatsapp} target="_blank" rel="noopener noreferrer" onClick={onUsado} className={clase} title={t('whatsapp')}>
        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
        <span className={compacto ? 'sr-only' : ''}>{t('whatsapp')}</span>
      </a>
      <a href={enlaces.sms} onClick={onUsado} className={clase} title={t('sms')}>
        <MessageSquareText className="h-3.5 w-3.5 text-brand-500" aria-hidden />
        <span className={compacto ? 'sr-only' : ''}>{t('sms')}</span>
      </a>
      <a href={enlaces.llamar} className={clase} title={t('llamar')}>
        <Phone className="h-3.5 w-3.5" aria-hidden />
        <span className={compacto ? 'sr-only' : ''}>{t('llamar')}</span>
      </a>
      {correo && (
        <a
          href={`mailto:${correo}${mensaje ? `?subject=${encodeURIComponent(asunto ?? '')}&body=${encodeURIComponent(mensaje)}` : ''}`}
          onClick={onUsado}
          className={clase}
          title={t('correo')}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          <span className={compacto ? 'sr-only' : ''}>{t('correo')}</span>
        </a>
      )}
    </div>
  );
}
