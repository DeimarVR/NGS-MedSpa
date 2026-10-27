'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { ApiError, api, setToken } from '@/lib/apiClient';
import { IDIOMAS, LISTA_IDIOMAS } from '@/lib/idiomas';
import { LogoPanel } from '@/components/admin/Marca';

export default function LoginPage() {
  const t = useTranslations('panel.login');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const datos = await api.post<{ token: string; user: { locale: Locale } }>('/api/auth/login', { email, password }, { auth: false });
      setToken(datos.token);
      // Entra en el idioma de su cuenta (lo cambia en «Mi cuenta» o en el menú).
      router.replace('/admin', { locale: datos.user.locale ?? locale });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneral'));
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-900 p-12 text-on-deep lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #9C6B53 0%, transparent 65%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 -start-24 h-[30rem] w-[30rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #E3B54B 0%, transparent 65%)' }}
        />
        <div className="relative flex items-center gap-3">
          <span className="rounded-2xl bg-white/95 px-3 py-2">
            <LogoPanel />
          </span>
        </div>
        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-400 rtl:tracking-normal">{t('kicker')}</p>
          <h1 className="mt-4 text-4xl leading-tight text-white">{t('lema')}</h1>
          <p className="mt-4 text-on-deep-muted">{t('texto')}</p>
        </div>
        <p className="relative text-xs text-on-deep-muted">{t('privado')}</p>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-brand-700">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            {t('volverSitio')}
          </Link>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only">{t('idioma')}</span>
            <select
              value={locale}
              onChange={(e) => router.replace('/admin/login', { locale: e.target.value as Locale })}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold text-ink"
            >
              {LISTA_IDIOMAS.map((l) => (
                <option key={l} value={l}>
                  {IDIOMAS[l].nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-8 lg:hidden">
            <LogoPanel />
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-100 text-accent-700">
            <LockKeyhole className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-5 text-3xl text-brand-900">{t('titulo')}</h2>
          <p className="mt-2 text-sm text-muted">{t('subtitulo')}</p>

          <form onSubmit={entrar} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="correo" className="field-label">
                {t('correo')}
              </label>
              <input
                id="correo"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="clave" className="field-label">
                {t('contrasena')}
              </label>
              <div className="relative">
                <input
                  id="clave"
                  type={ver ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field pe-12"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  className="absolute end-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-brand-50"
                  aria-label={ver ? t('ocultar') : t('mostrar')}
                >
                  {ver ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            <button type="submit" disabled={enviando || !email || !password} className="btn-primary w-full py-3.5">
              {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {enviando ? t('entrando') : t('entrar')}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted">{t('olvido')}</p>
        </div>
      </section>
    </div>
  );
}
