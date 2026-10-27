'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { api, clearToken, getToken } from '@/lib/apiClient';
import type { AdminUser } from '@/lib/types';

/**
 * Comprueba la sesión antes de montar el panel. La seguridad de verdad está en
 * la API (cada ruta exige sesión y rol); esto solo evita dibujar un panel que
 * va a fallar en cada llamada.
 */
const ContextoUsuario = createContext<{ usuario: AdminUser; refrescar: (u: AdminUser) => void } | null>(null);

export function useUsuario() {
  const valor = useContext(ContextoUsuario);
  if (!valor) throw new Error('useUsuario fuera del panel');
  return valor;
}

export function AuthGuard({ children }: { children: (usuario: AdminUser) => React.ReactNode }) {
  const t = useTranslations('panel.shell');
  const router = useRouter();
  const [usuario, setUsuario] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelado = false;
    if (!getToken()) {
      router.replace('/admin/login');
      return;
    }
    api
      .get<{ user: AdminUser }>('/api/auth/me')
      .then((datos) => {
        if (!cancelado) setUsuario(datos.user);
      })
      .catch(() => {
        clearToken();
        router.replace('/admin/login');
      });
    return () => {
      cancelado = true;
    };
  }, [router]);

  if (!usuario) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" aria-hidden />
        <span className="sr-only">{t('verificando')}</span>
      </div>
    );
  }

  return <ContextoUsuario.Provider value={{ usuario, refrescar: setUsuario }}>{children(usuario)}</ContextoUsuario.Provider>;
}
