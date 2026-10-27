'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, Clock, FileSignature, Loader2, Sparkles, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { SubidaImagen } from '@/components/admin/SubidaImagen';
import { CajaError, CajaOk, Cargando, Encabezado } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

type Ajustes = { telefono: string; instagram: string; facebook: string; tiktok: string; mapaUrl: string; fotoEsencia: string; cupos: string; impuestoBps: string; notaRecibo: string };
interface Dia {
  dayOfWeek: number;
  active: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}

function Horario() {
  const { datos } = useCarga<{ items: Dia[] }>('/api/horario');
  return datos ? <HorarioForm inicial={datos.items} /> : <Cargando />;
}

function HorarioForm({ inicial }: { inicial: Dia[] }) {
  const t = useTranslations('panel.config.horario');
  const tDia = useTranslations('sitio.dias');
  const tc = useTranslations('comun');
  const [dias, setDias] = useState<Dia[]>(inicial);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cambiar = (d: number, c: Partial<Dia>) => setDias((ds) => ds.map((x) => (x.dayOfWeek === d ? { ...x, ...c } : x)));

  async function guardar() {
    setOk(null);
    setError(null);
    try {
      await api.put('/api/horario', { dias: dias.map((d) => ({ ...d, breakStart: d.breakStart || null, breakEnd: d.breakEnd || null })) });
      setOk(tc('guardado'));
    } catch (e) {
      setError(mensajeDe(e));
    }
  }

  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2 text-lg">
        <Clock className="h-5 w-5 text-accent-500" aria-hidden />
        {t('titulo')}
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted">{t('texto')}</p>
      <ul className="divide-y divide-line">
        {[1, 2, 3, 4, 5, 6, 0].map((n) => {
          const d = dias.find((x) => x.dayOfWeek === n);
          if (!d) return null;
          return (
            <li key={n} className="grid items-center gap-3 py-3 sm:grid-cols-[9rem_1fr]">
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" checked={d.active} onChange={(e) => cambiar(n, { active: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                {tDia(String(n) as '0')}
              </label>
              {d.active ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="time" className="field w-32 py-2" value={d.openTime} onChange={(e) => cambiar(n, { openTime: e.target.value })} aria-label={t('abre')} />
                  <span>–</span>
                  <input type="time" className="field w-32 py-2" value={d.closeTime} onChange={(e) => cambiar(n, { closeTime: e.target.value })} aria-label={t('cierra')} />
                  <span className="ms-2 text-muted">{t('pausa')}</span>
                  <input type="time" className="field w-32 py-2" value={d.breakStart ?? ''} onChange={(e) => cambiar(n, { breakStart: e.target.value || null })} aria-label={t('pausaDesde')} />
                  <span>–</span>
                  <input type="time" className="field w-32 py-2" value={d.breakEnd ?? ''} onChange={(e) => cambiar(n, { breakEnd: e.target.value || null })} aria-label={t('pausaHasta')} />
                </div>
              ) : (
                <p className="text-sm text-muted">{t('cerrado')}</p>
              )}
            </li>
          );
        })}
      </ul>
      {ok && <CajaOk mensaje={ok} />}
      {error && <CajaError mensaje={error} />}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={guardar} className="btn-primary">
          {tc('guardar')}
        </button>
      </div>
    </section>
  );
}

function Clinica() {
  const { datos } = useCarga<Ajustes>('/api/ajustes');
  return datos ? <ClinicaForm inicial={datos} /> : <Cargando />;
}

function ClinicaForm({ inicial }: { inicial: Ajustes }) {
  const t = useTranslations('panel.config.clinica');
  const tc = useTranslations('comun');
  const [a, setA] = useState<Ajustes>(inicial);
  const [tasa, setTasa] = useState(String(Number(inicial.impuestoBps) / 100));
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poner = (k: keyof Ajustes, v: string) => setA((x) => ({ ...x, [k]: v }));

  async function guardar() {
    setGuardando(true);
    setOk(null);
    setError(null);
    try {
      setA(await api.put<Ajustes>('/api/ajustes', a));
      setOk(tc('guardado'));
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg">{t('titulo')}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">{t('texto')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">{t('telefono')}</span>
          <input className="field" dir="ltr" value={a.telefono} onChange={(e) => poner('telefono', e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">{t('instagram')}</span>
          <input className="field" dir="ltr" value={a.instagram} onChange={(e) => poner('instagram', e.target.value)} />
        </label>
        <label className="block">
          <span className="field-label">{t('facebook')}</span>
          <input className="field" dir="ltr" value={a.facebook} onChange={(e) => poner('facebook', e.target.value)} placeholder="https://www.facebook.com/…" />
        </label>
        <label className="block">
          <span className="field-label">{t('tiktok')}</span>
          <input className="field" dir="ltr" value={a.tiktok} onChange={(e) => poner('tiktok', e.target.value)} placeholder="https://www.tiktok.com/@…" />
        </label>
        <p className="-mt-2 text-xs text-muted sm:col-span-2">{t('redesAyuda')}</p>
        <label className="block sm:col-span-2">
          <span className="field-label">{t('mapa')}</span>
          <input className="field" dir="ltr" value={a.mapaUrl} onChange={(e) => poner('mapaUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
          <span className="mt-1 block text-xs text-muted">{t('mapaAyuda')}</span>
        </label>
        <label className="block">
          <span className="field-label">{t('cupos')}</span>
          <input type="number" min={1} max={10} className="field" value={a.cupos} onChange={(e) => poner('cupos', e.target.value)} />
          <span className="mt-1 block text-xs text-muted">{t('cuposAyuda')}</span>
        </label>
        <label className="block">
          <span className="field-label">{t('impuesto')}</span>
          <div className="flex items-center gap-2">
            <input
              className="field"
              inputMode="decimal"
              dir="ltr"
              value={tasa}
              onChange={(e) => {
                setTasa(e.target.value);
                poner('impuestoBps', String(Math.round((Number(e.target.value.replace(',', '.')) || 0) * 100)));
              }}
            />
            <span>%</span>
          </div>
          <span className="mt-1 block text-xs text-muted">{t('impuestoAyuda')}</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">{t('notaRecibo')}</span>
          <textarea className="field min-h-16" value={a.notaRecibo} onChange={(e) => poner('notaRecibo', e.target.value)} placeholder={t('notaReciboEjemplo')} />
        </label>
        <div className="sm:col-span-2">
          <span className="field-label">{t('fotoEsencia')}</span>
          <div className="flex flex-wrap items-center gap-3">
            {a.fotoEsencia && <img src={a.fotoEsencia} alt="" className="h-20 w-28 rounded-xl object-cover" />}
            <SubidaImagen carpeta="sitio" onSubida={(r) => poner('fotoEsencia', r)} texto={a.fotoEsencia ? t('cambiarFoto') : t('subirFoto')} />
            {a.fotoEsencia && (
              <button type="button" onClick={() => poner('fotoEsencia', '')} className="text-sm font-bold text-muted hover:text-red-600">
                {tc('quitar')}
              </button>
            )}
          </div>
          <span className="mt-1 block text-xs text-muted">{t('fotoAyuda')}</span>
        </div>
      </div>
      {ok && <CajaOk mensaje={ok} />}
      {error && <CajaError mensaje={error} />}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={guardar} disabled={guardando} className="btn-primary">
          {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {tc('guardar')}
        </button>
      </div>
    </section>
  );
}

export default function Configuracion() {
  const t = useTranslations('panel.config');
  const atajos = [
    { href: '/admin/configuracion/tratamientos', icono: Sparkles, titulo: t('atajoTratamientos'), texto: t('tratamientosTexto') },
    { href: '/admin/configuracion/consentimientos', icono: FileSignature, titulo: t('atajoConsentimientos'), texto: t('consentimientosTexto') },
    { href: '/admin/configuracion/usuarios', icono: Users, titulo: t('atajoUsuarios'), texto: t('usuariosTexto') },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')} />
      <div className="grid gap-3 md:grid-cols-3">
        {atajos.map((a) => (
          <Link key={a.href} href={a.href} className="card group flex items-start gap-3 p-5 transition-transform hover:-translate-y-0.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-100 text-accent-700">
              <a.icono className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between font-bold">
                {a.titulo}
                <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden />
              </span>
              <span className="mt-0.5 block text-sm text-muted">{a.texto}</span>
            </span>
          </Link>
        ))}
      </div>
      <Clinica />
      <Horario />
    </div>
  );
}
