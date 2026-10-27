'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, UserPlus } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { IDIOMAS, LISTA_IDIOMAS } from '@/lib/idiomas';
import { useFormato } from '@/lib/useFormato';
import { ROLES, type Role } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { CajaError, Cargando, Encabezado, Modal, Pastilla } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

interface Usuario {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  active: boolean;
  locale: Locale;
  credentials: string | null;
  lastLoginAt: string | null;
}

export default function Usuarios() {
  const t = useTranslations('panel.config.usuarios');
  const tRol = useTranslations('estados.rol');
  const tc = useTranslations('comun');
  const locale = useLocale() as Locale;
  const fmt = useFormato();
  const { usuario: yo } = useUsuario();
  const { datos, cargando, error, recargar } = useCarga<{ items: Usuario[] }>('/api/users');
  const [editando, setEditando] = useState<Usuario | 'nuevo' | null>(null);
  const [f, setF] = useState({ email: '', fullName: '', role: 'PROFESIONAL' as Role, locale, credentials: '', password: '', active: true });
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  function abrir(u: Usuario | 'nuevo') {
    setFallo(null);
    setEditando(u);
    setF(u === 'nuevo' ? { email: '', fullName: '', role: 'PROFESIONAL', locale, credentials: '', password: '', active: true } : { email: u.email, fullName: u.fullName, role: u.role, locale: u.locale, credentials: u.credentials ?? '', password: '', active: u.active });
  }

  async function guardar() {
    if (!editando) return;
    setGuardando(true);
    setFallo(null);
    try {
      if (editando === 'nuevo') await api.post('/api/users', { ...f, credentials: f.credentials || undefined });
      else await api.patch(`/api/users/${editando.id}`, { fullName: f.fullName, role: f.role, locale: f.locale, credentials: f.credentials || null, active: f.active, ...(f.password ? { password: f.password } : {}) });
      setEditando(null);
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/configuracion" className="mb-4 inline-flex text-sm font-bold text-muted hover:text-brand-700">
        ← {tc('volver')}
      </Link>
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button type="button" onClick={() => abrir('nuevo')} className="btn-grad">
          <UserPlus className="h-4 w-4" aria-hidden />
          {t('nuevo')}
        </button>
      </Encabezado>
      {error && <CajaError mensaje={error} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <ul className="card divide-y divide-line">
          {datos?.items.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => abrir(u)} className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-start hover:bg-brand-50/60 ${u.active ? '' : 'opacity-60'}`}>
                <span className="min-w-0">
                  <span className="block font-bold">
                    {u.fullName}
                    {u.credentials ? `, ${u.credentials}` : ''}
                    {u.id === yo.id && <span className="ms-2 text-xs font-normal text-muted">({t('tu')})</span>}
                  </span>
                  <span className="block text-sm text-muted">
                    {u.email} · {u.lastLoginAt ? t('ultimoIngreso', { cuando: fmt.relativo(u.lastLoginAt) }) : t('nuncaEntro')}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <Pastilla tono={u.role === 'ADMIN' ? 'oro' : 'azul'}>{tRol(u.role)}</Pastilla>
                  {!u.active && <Pastilla tono="gris">{t('inactivo')}</Pastilla>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 rounded-2xl bg-cream p-4 text-sm text-muted">
        <p className="font-bold text-ink">{t('rolesTitulo')}</p>
        <ul className="mt-2 space-y-1">
          {ROLES.map((r) => (
            <li key={r}>
              <b>{tRol(r)}:</b> {t(`roles.${r}`)}
            </li>
          ))}
        </ul>
      </div>
      <Modal
        abierto={editando !== null}
        titulo={editando === 'nuevo' ? t('nuevo') : t('editar')}
        onCerrar={() => setEditando(null)}
        pie={
          <>
            <button type="button" onClick={() => setEditando(null)} className="btn-outline">
              {tc('cancelar')}
            </button>
            <button type="button" onClick={guardar} disabled={guardando} className="btn-primary">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {tc('guardar')}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="field-label">{t('correo')}</span>
            <input className="field" type="email" dir="ltr" disabled={editando !== 'nuevo'} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">{t('nombre')}</span>
            <input className="field" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">{t('credencial')}</span>
            <input className="field" value={f.credentials} onChange={(e) => setF({ ...f, credentials: e.target.value })} placeholder="RN, NP, PA-C…" />
          </label>
          <label className="block">
            <span className="field-label">{t('rol')}</span>
            <select className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {tRol(r)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">{t('idioma')}</span>
            <select className="field" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value as Locale })}>
              {LISTA_IDIOMAS.map((l) => (
                <option key={l} value={l}>
                  {IDIOMAS[l].nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">{editando === 'nuevo' ? t('clave') : t('claveNueva')}</span>
            <input className="field" type="password" autoComplete="new-password" dir="ltr" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <span className="mt-1 block text-xs text-muted">{t('claveAyuda')}</span>
          </label>
          {editando !== 'nuevo' && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 accent-brand-700" />
              {t('activo')}
            </label>
          )}
        </div>
        {fallo && (
          <div className="mt-4">
            <CajaError mensaje={fallo} />
          </div>
        )}
      </Modal>
    </div>
  );
}
