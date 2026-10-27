'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { IDIOMAS, LISTA_IDIOMAS } from '@/lib/idiomas';
import type { AdminUser } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { FirmaPad } from '@/components/admin/FirmaPad';
import { CajaError, CajaOk, Encabezado } from '@/components/admin/ui';
import { mensajeDe } from '@/components/admin/useCarga';

export default function Cuenta() {
  const t = useTranslations('panel.cuenta');
  const tRol = useTranslations('estados.rol');
  const tc = useTranslations('comun');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { usuario, refrescar } = useUsuario();
  const [nombre, setNombre] = useState(usuario.fullName);
  const [credencial, setCredencial] = useState(usuario.credentials ?? '');
  const [idioma, setIdioma] = useState<Locale>(usuario.locale ?? locale);
  const [firma, setFirma] = useState<string | null>(usuario.signature ?? null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [otraVez, setOtraVez] = useState('');
  const [okClave, setOkClave] = useState<string | null>(null);
  const [errorClave, setErrorClave] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setOk(null);
    setError(null);
    try {
      const r = await api.put<{ user: AdminUser }>('/api/auth/me', { fullName: nombre, credentials: credencial || null, locale: idioma, signature: firma });
      refrescar(r.user);
      setOk(tc('guardado'));
      if (idioma !== locale) router.replace(pathname, { locale: idioma });
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarClave(e: React.FormEvent) {
    e.preventDefault();
    setOkClave(null);
    setErrorClave(null);
    if (nueva !== otraVez) return setErrorClave(t('noCoinciden'));
    try {
      await api.post('/api/auth/change-password', { currentPassword: actual, newPassword: nueva });
      setActual('');
      setNueva('');
      setOtraVez('');
      setOkClave(t('claveCambiada'));
    } catch (err) {
      setErrorClave(mensajeDe(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado titulo={t('titulo')} bajada={`${usuario.email} · ${tRol(usuario.role)}`} />
      <form onSubmit={guardar} className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">{t('nombre')}</span>
            <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="block">
            <span className="field-label">{t('credencial')}</span>
            <input className="field" value={credencial} onChange={(e) => setCredencial(e.target.value)} placeholder={t('credencialEjemplo')} />
          </label>
          <label className="block">
            <span className="field-label">{t('idioma')}</span>
            <select className="field" value={idioma} onChange={(e) => setIdioma(e.target.value as Locale)}>
              {LISTA_IDIOMAS.map((l) => (
                <option key={l} value={l}>
                  {IDIOMAS[l].nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className="field-label">{t('firma')}</p>
          <FirmaPad valor={firma} onCambio={setFirma} ayuda={t('firmaAyuda')} />
        </div>
        {ok && <CajaOk mensaje={ok} />}
        {error && <CajaError mensaje={error} />}
        <div className="flex justify-end">
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {tc('guardar')}
          </button>
        </div>
      </form>

      <form onSubmit={cambiarClave} className="card mt-6 space-y-4 p-6">
        <h2 className="text-lg">{t('cambiarClave')}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [actual, setActual, t('claveActual'), 'current-password'],
            [nueva, setNueva, t('claveNueva'), 'new-password'],
            [otraVez, setOtraVez, t('claveOtraVez'), 'new-password'],
          ].map(([v, set, etiqueta, auto]) => (
            <label key={etiqueta as string} className="block">
              <span className="field-label">{etiqueta as string}</span>
              <input type="password" autoComplete={auto as string} className="field" dir="ltr" value={v as string} onChange={(e) => (set as (x: string) => void)(e.target.value)} />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">{t('claveAyuda')}</p>
        {okClave && <CajaOk mensaje={okClave} />}
        {errorClave && <CajaError mensaje={errorClave} />}
        <div className="flex justify-end">
          <button type="submit" disabled={!actual || nueva.length < 8} className="btn-outline">
            {t('cambiarClave')}
          </button>
        </div>
      </form>
    </div>
  );
}
