'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Formulario «Escríbenos». Lo que se manda llega a la bandeja de Mensajes del
 * panel (/api/public/contact). No existía en basico.html: lo pide la bandeja.
 */
export function FormularioContacto() {
  const t = useTranslations('sitio.contacto');
  const locale = useLocale();
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'enviado' | 'error'>('listo');
  const [error, setError] = useState('');

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEstado('enviando');
    setError('');
    try {
      const r = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idioma': locale },
        body: JSON.stringify({ ...datos, locale }),
      });
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => ({}))) as { message?: string; details?: Array<{ message: string }> };
        setError(cuerpo.details?.map((d) => d.message).join(' · ') || cuerpo.message || t('error'));
        setEstado('error');
        return;
      }
      form.reset();
      setEstado('enviado');
    } catch {
      setError(t('error'));
      setEstado('error');
    }
  }

  return (
    <form onSubmit={enviar} noValidate={false}>
      <label>
        {t('nombre')}
        <input name="name" required minLength={2} maxLength={120} autoComplete="name" />
      </label>
      <label>
        {t('telefono')}
        <input name="phone" required minLength={7} maxLength={30} type="tel" autoComplete="tel" inputMode="tel" />
      </label>
      <label className="ancho">
        {t('correo')}
        <input name="email" type="email" maxLength={160} autoComplete="email" />
      </label>
      <label className="ancho">
        {t('mensaje')}
        <textarea name="message" required minLength={5} maxLength={2000} rows={4} />
      </label>
      {/* Trampa para robots: una persona no ve ni llena este campo. */}
      <input name="empresa" tabIndex={-1} autoComplete="off" aria-hidden="true" className="trampa" />
      <div className="ancho">
        <button className="btn btn-dark" type="submit" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? t('enviando') : t('enviar')}
        </button>
      </div>
      {estado === 'enviado' && (
        <p className="estado ok" role="status">
          {t('enviado')}
        </p>
      )}
      {estado === 'error' && (
        <p className="estado mal" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
