'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarDays,
  ChevronUp,
  ClipboardList,
  FileSignature,
  HandCoins,
  Images,
  Languages,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { api, clearToken } from '@/lib/apiClient';
import { IDIOMAS, LISTA_IDIOMAS } from '@/lib/idiomas';
import type { AdminUser, Role } from '@/lib/types';
import type { Mensajes } from '@/lib/mensajes';
import { AuthGuard, useUsuario } from './AuthGuard';
import { CampanaAvisos } from './CampanaAvisos';
import { DialogoHost } from './Dialogo';
import { LogoPanel, MarcaNgs } from './Marca';

type Icono = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;

type ClaveNav = Exclude<keyof Mensajes['panel']['nav'], 'grupos'>;
type ClaveGrupo = keyof Mensajes['panel']['nav']['grupos'];

interface Entrada {
  href: string;
  clave: ClaveNav;
  icono: Icono;
  /** Quién ve el enlace (la API exige el rol por su cuenta: esto solo ordena). */
  roles?: Role[];
  avisa?: 'mensajes';
}

const NAV: Array<{ clave: ClaveGrupo; entradas: Entrada[] }> = [
  {
    clave: 'diaADia',
    entradas: [
      { href: '/admin', clave: 'tablero', icono: LayoutDashboard },
      { href: '/admin/citas', clave: 'citas', icono: CalendarDays },
      { href: '/admin/clientas', clave: 'clientas', icono: Users },
      { href: '/admin/mapa-facial', clave: 'mapaFacial', icono: ClipboardList, roles: ['ADMIN', 'PROFESIONAL'] },
      { href: '/admin/consentimientos', clave: 'consentimientos', icono: FileSignature },
      { href: '/admin/fotos', clave: 'fotos', icono: Images, roles: ['ADMIN', 'PROFESIONAL'] },
      { href: '/admin/mensajes', clave: 'mensajes', icono: Mail, avisa: 'mensajes' },
    ],
  },
  {
    clave: 'dinero',
    entradas: [
      { href: '/admin/recibos', clave: 'recibos', icono: Receipt },
      { href: '/admin/por-cobrar', clave: 'porCobrar', icono: HandCoins, roles: ['ADMIN', 'RECEPCION'] },
      { href: '/admin/caja', clave: 'caja', icono: Wallet, roles: ['ADMIN', 'RECEPCION'] },
      { href: '/admin/inventario', clave: 'inventario', icono: Package },
    ],
  },
];

/** Secciones fuera de la barra, con su rol: escribir la dirección a mano no las abre. */
const FUERA_DE_LA_BARRA: Array<{ href: string; roles?: Role[] }> = [
  { href: '/admin/configuracion', roles: ['ADMIN'] },
  { href: '/admin/cuenta' },
];

const SECCIONES: Array<{ href: string; roles?: Role[] }> = [...NAV.flatMap((g) => g.entradas), ...FUERA_DE_LA_BARRA];

function seccionDe(pathname: string) {
  return SECCIONES.find((s) => (s.href === '/admin' ? pathname === '/admin' : pathname.startsWith(s.href)));
}

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

const CLAVE_PLEGADA = 'ngs:barra-plegada';

function MenuDePerfil({ usuario, plegada }: { usuario: AdminUser; plegada: boolean }) {
  const t = useTranslations('panel.shell');
  const tRol = useTranslations('estados.rol');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { refrescar } = useUsuario();
  const [abierto, setAbierto] = useState(false);
  const [idiomas, setIdiomas] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  async function cambiarIdioma(nuevo: Locale) {
    setAbierto(false);
    if (nuevo === locale) return;
    // Se guarda en su cuenta: la próxima vez entra en ese idioma.
    api
      .put<{ user: AdminUser }>('/api/auth/me', { locale: nuevo })
      .then((d) => refrescar(d.user))
      .catch(() => undefined);
    router.replace(`${pathname}${window.location.search}`, { locale: nuevo });
  }

  const soloAncha = plegada ? 'lg:hidden' : '';
  return (
    <div ref={caja} className="relative min-w-0 flex-1">
      {abierto && (
        <div
          className={`absolute bottom-full start-0 z-50 mb-2 w-full min-w-52 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift ${
            plegada ? 'lg:bottom-0 lg:start-full lg:mb-0 lg:ms-2 lg:w-56' : ''
          }`}
        >
          <Link href="/admin/cuenta" className="flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-brand-50">
            <UserRound className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
            {t('miCuenta')}
          </Link>
          {usuario.role === 'ADMIN' && (
            <Link href="/admin/configuracion" className="flex items-center gap-2.5 border-t border-line px-4 py-3 text-sm hover:bg-brand-50">
              <Settings className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
              {t('configuracion')}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIdiomas((v) => !v)}
            aria-expanded={idiomas}
            className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3 text-start text-sm hover:bg-brand-50"
          >
            <Languages className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
            <span className="flex-1">{t('idioma')}</span>
            <span className="text-xs font-bold text-muted">{IDIOMAS[locale].corto}</span>
          </button>
          {idiomas && (
            <div className="grid grid-cols-1 border-t border-line bg-cream py-1">
              {LISTA_IDIOMAS.map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  dir={IDIOMAS[l].dir}
                  onClick={() => cambiarIdioma(l)}
                  aria-current={l === locale ? 'true' : undefined}
                  className={`px-6 py-2 text-start text-sm hover:bg-brand-50 ${l === locale ? 'font-bold text-brand-700' : ''}`}
                >
                  {IDIOMAS[l].nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="true"
        aria-label={t('perfil', { nombre: usuario.fullName, rol: tRol(usuario.role) })}
        title={plegada ? `${usuario.fullName} · ${tRol(usuario.role)}` : undefined}
        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-start transition-colors hover:bg-brand-50 ${plegada ? 'lg:justify-center lg:px-0' : ''}`}
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-100 text-xs font-bold text-accent-700 ${plegada ? '' : 'lg:hidden'}`}>
          {iniciales(usuario.fullName)}
        </span>
        <span className={`min-w-0 flex-1 ${soloAncha}`}>
          <span className="block truncate text-sm font-bold">{usuario.fullName}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">{tRol(usuario.role)}</span>
        </span>
        <ChevronUp className={`h-4 w-4 shrink-0 text-muted transition-transform ${soloAncha} ${abierto ? '' : 'rotate-180'}`} strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}

function Marco({ usuario, children }: { usuario: AdminUser; children: React.ReactNode }) {
  const t = useTranslations('panel.shell');
  const tNav = useTranslations('panel.nav');
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  // Esto solo se dibuja en el navegador (después de comprobar la sesión):
  // se puede leer el almacenamiento al crear el estado.
  const [plegada, setPlegada] = useState(() => {
    try {
      return window.localStorage.getItem(CLAVE_PLEGADA) === '1';
    } catch {
      return false;
    }
  });
  const [pendientes, setPendientes] = useState({ mensajes: 0 });
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const control = new AbortController();
    api
      .get<{ sinAtender: number }>('/api/contact-messages?handled=false&take=1', { signal: control.signal })
      .then((d) => setPendientes({ mensajes: d.sinAtender ?? 0 }))
      .catch(() => undefined);
    return () => control.abort();
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', tecla);
    botonCerrar.current?.focus();
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [menuAbierto]);

  function alternarPlegada() {
    setPlegada((antes) => {
      try {
        window.localStorage.setItem(CLAVE_PLEGADA, antes ? '0' : '1');
      } catch {
        /* nada */
      }
      return !antes;
    });
  }

  function salir() {
    clearToken();
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    router.replace('/admin/login');
  }

  const seccion = seccionDe(pathname);
  const puedeVer = !seccion?.roles || seccion.roles.includes(usuario.role);
  const grupos = NAV.map((g) => ({ ...g, entradas: g.entradas.filter((e) => !e.roles || e.roles.includes(usuario.role)) })).filter((g) => g.entradas.length);
  const soloAncha = plegada ? 'lg:hidden' : '';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <header className="no-imprimir sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 lg:hidden">
        <Link href="/admin" aria-label={tNav('tablero')}>
          <LogoPanel />
        </Link>
        <div className="flex items-center gap-2">
          <CampanaAvisos arriba />
          <button
            ref={botonMenu}
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-expanded={menuAbierto}
            aria-controls="menu-panel"
            className="grid h-10 w-10 place-items-center rounded-xl border border-line text-ink hover:bg-brand-50"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            <span className="sr-only">{t('abrirMenu')}</span>
          </button>
        </div>
      </header>

      {menuAbierto && (
        <button type="button" onClick={() => setMenuAbierto(false)} aria-label={t('cerrarMenu')} className="fixed inset-0 z-40 bg-ink/50 lg:hidden" />
      )}

      <aside
        id="menu-panel"
        className={`no-imprimir fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:max-w-none lg:visible lg:ltr:translate-x-0 lg:rtl:translate-x-0 transition-[transform,visibility,width] ${plegada ? 'lg:w-[76px]' : 'lg:w-60'} ${menuAbierto ? 'visible translate-x-0' : 'invisible ltr:-translate-x-full rtl:translate-x-full'}`}
      >
        <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-line p-5 lg:p-4 ${plegada ? 'lg:justify-center lg:p-3' : ''}`}>
          <Link href="/admin" aria-label={tNav('tablero')}>
            <span className={soloAncha}>
              <LogoPanel />
            </span>
            {plegada && <MarcaNgs tamano={36} className="hidden lg:block" />}
          </Link>
          <button
            ref={botonCerrar}
            type="button"
            onClick={() => {
              setMenuAbierto(false);
              botonMenu.current?.focus();
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-brand-50 lg:hidden"
          >
            <X className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            <span className="sr-only">{t('cerrarMenu')}</span>
          </button>
        </div>

        <nav className={`flex flex-1 flex-col overflow-y-auto p-3 ${plegada ? 'lg:px-2' : 'lg:p-2.5'}`}>
          {grupos.map((grupo, i) => (
            <div key={grupo.clave} role="group" aria-label={tNav(`grupos.${grupo.clave}`)} className={i > 0 ? 'mt-4' : ''}>
              <p aria-hidden className={`px-3 pb-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-muted rtl:tracking-normal ${soloAncha}`}>
                {tNav(`grupos.${grupo.clave}`)}
              </p>
              {plegada && i > 0 && <span className="mx-auto mb-2 hidden h-px w-6 bg-line lg:block" aria-hidden />}
              <div className="flex flex-col gap-0.5">
                {grupo.entradas.map((e) => {
                  const activo = e.href === '/admin' ? pathname === '/admin' : pathname.startsWith(e.href);
                  const pendiente = e.avisa ? pendientes[e.avisa] : 0;
                  return (
                    <Link
                      key={e.href}
                      href={e.href}
                      onClick={() => setMenuAbierto(false)}
                      aria-current={activo ? 'page' : undefined}
                      title={tNav(e.clave)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors lg:px-3 lg:py-2.5 ${
                        plegada ? 'lg:justify-center lg:px-0' : ''
                      } ${activo ? 'bg-brand-700 text-white' : 'text-ink/75 hover:bg-brand-50 hover:text-brand-800'}`}
                    >
                      <span className="relative shrink-0">
                        <e.icono className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                        {pendiente > 0 && plegada && <span className="absolute -end-1.5 -top-1 hidden h-2 w-2 rounded-full bg-red-500 ring-2 ring-surface lg:block" aria-hidden />}
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${soloAncha}`}>{tNav(e.clave)}</span>
                      {pendiente > 0 && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${soloAncha} ${activo ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                          {pendiente}
                          <span className="sr-only"> {t('sinAtender')}</span>
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`shrink-0 border-t border-line bg-surface p-4 ${plegada ? 'lg:px-2' : ''}`}>
          <div className={`flex items-center justify-between gap-2 ${plegada ? 'lg:flex-col' : ''}`}>
            <MenuDePerfil key={pathname} usuario={usuario} plegada={plegada} />
            <div className="hidden shrink-0 lg:block">
              <CampanaAvisos />
            </div>
          </div>
          <button
            type="button"
            onClick={salir}
            title={plegada ? t('salir') : undefined}
            className={`mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-red-50 hover:text-red-600 ${plegada ? 'lg:mt-2 lg:justify-center lg:px-0' : ''}`}
          >
            <LogOut className="h-4 w-4 shrink-0 rtl:-scale-x-100" strokeWidth={1.8} aria-hidden />
            <span className={soloAncha}>{t('salir')}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={alternarPlegada}
          title={plegada ? t('ampliar') : t('reducir')}
          className="absolute end-0 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 lg:grid ltr:translate-x-1/2 rtl:-translate-x-1/2"
        >
          {plegada ? <PanelLeftOpen className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.8} aria-hidden /> : <PanelLeftClose className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.8} aria-hidden />}
          <span className="sr-only">{plegada ? t('ampliar') : t('reducir')}</span>
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden bg-cream p-5 pb-24 sm:p-8 sm:pb-24 lg:p-10 lg:pb-16">
        {puedeVer ? (
          children
        ) : (
          <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface px-6 py-16 text-center">
            <Lock className="mx-auto h-7 w-7 text-brand-300" strokeWidth={1.5} aria-hidden />
            <h1 className="mt-4 text-xl">{t('sinAcceso')}</h1>
            <p className="mt-2 text-sm text-muted">{t('sinAccesoTexto')}</p>
            <Link href="/admin" className="btn-primary mt-8">
              {t('volverTablero')}
            </Link>
          </div>
        )}
      </main>
      <DialogoHost />
    </div>
  );
}

export function PanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin/login') return <>{children}</>;
  return <AuthGuard>{(usuario) => <Marco usuario={usuario}>{children}</Marco>}</AuthGuard>;
}
