'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import type { Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { IDIOMAS } from '@/lib/idiomas';
import { nombreTratamiento, olvidarTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import { CATEGORIAS, type Service, type ServiceCategory } from '@/lib/types';
import { CampoDinero } from '@/components/admin/CampoDinero';
import { CajaError, Cargando, Encabezado, Modal, Pastilla, Pestanas } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

type Otro = 'en' | 'fr' | 'ar' | 'ja';
const OTROS: Otro[] = ['en', 'fr', 'ar', 'ja'];

function vacio(): Service {
  return {
    id: '',
    slug: '',
    name: '',
    shortDesc: '',
    description: '',
    category: 'TOXINA',
    durationMin: 60,
    priceCents: null,
    priceMode: 'DESDE',
    touchUpDays: null,
    icon: 'sparkles',
    benefits: [],
    featured: false,
    active: true,
    published: true,
    sortOrder: 100,
    translations: {},
  };
}

const aSlug = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

export default function Tratamientos() {
  const t = useTranslations('panel.config.tratamientos');
  const tCat = useTranslations('estados.categoria');
  const tPrecio = useTranslations('estados.precio');
  const tEstados = useTranslations('estados');
  const tc = useTranslations('comun');
  const locale = useLocale() as Locale;
  const fmt = useFormato();
  const { datos, cargando, error, recargar } = useCarga<{ items: Service[] }>('/api/treatments');
  const [s, setS] = useState<Service | null>(null);
  const [idioma, setIdioma] = useState<'es' | Otro>('es');
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  function abrir(x: Service | null) {
    setFallo(null);
    setIdioma('es');
    setS(x ? { ...x, translations: { ...(x.translations ?? {}) } } : vacio());
  }

  const texto = (campo: 'name' | 'shortDesc') => (idioma === 'es' ? (s?.[campo] ?? '') : (s?.translations?.[idioma]?.[campo] ?? ''));
  function ponerTexto(campo: 'name' | 'shortDesc', v: string) {
    setS((x) => {
      if (!x) return x;
      if (idioma === 'es') return { ...x, [campo]: v, ...(campo === 'name' && !x.id ? { slug: aSlug(v) } : {}) };
      return { ...x, translations: { ...x.translations, [idioma]: { ...(x.translations?.[idioma] ?? {}), [campo]: v } } };
    });
  }

  async function guardar() {
    if (!s) return;
    setGuardando(true);
    setFallo(null);
    const { id, ...resto } = s;
    const cuerpo = { ...resto, priceCents: s.priceCents, touchUpDays: s.touchUpDays || null };
    try {
      if (id) await api.put(`/api/treatments/${id}`, cuerpo);
      else await api.post('/api/treatments', cuerpo);
      olvidarTratamientos();
      setS(null);
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/configuracion" className="mb-4 inline-flex text-sm font-bold text-muted hover:text-brand-700">
        ← {tc('volver')}
      </Link>
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button type="button" onClick={() => abrir(null)} className="btn-grad">
          <Plus className="h-4 w-4" aria-hidden />
          {t('nuevo')}
        </button>
      </Encabezado>
      {error && <CajaError mensaje={error} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <div className="space-y-6">
          {CATEGORIAS.map((cat) => {
            const lista = (datos?.items ?? []).filter((x) => x.category === cat);
            if (!lista.length) return null;
            return (
              <section key={cat}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent-700 rtl:tracking-normal">{tCat(cat)}</h2>
                <ul className="card divide-y divide-line">
                  {lista.map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => abrir(x)} className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-start hover:bg-brand-50/60 ${x.active ? '' : 'opacity-50'}`}>
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{nombreTratamiento(x, locale)}</span>
                          <span className="block truncate text-xs text-muted">
                            {fmt.duracion(x.durationMin)}
                            {x.touchUpDays ? ` · ${t('retoqueCada', { n: x.touchUpDays })}` : ''}
                            {` · ${OTROS.filter((o) => x.translations?.[o]?.name).length + 1}/5 ${t('idiomas')}`}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {x.priceCents !== null && (
                            <span className="text-sm font-bold">
                              {tEstados('precioMonto', { modo: x.priceMode, precio: fmt.dinero(x.priceCents, true) })}
                            </span>
                          )}
                          {!x.published && x.active && <Pastilla tono="gris">{t('soloInterno')}</Pastilla>}
                          {!x.active && <Pastilla tono="gris">{t('inactivo')}</Pastilla>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        abierto={s !== null}
        titulo={s?.id ? t('editar') : t('nuevo')}
        onCerrar={() => setS(null)}
        ancho="max-w-3xl"
        pie={
          <>
            <button type="button" onClick={() => setS(null)} className="btn-outline">
              {tc('cancelar')}
            </button>
            <button type="button" onClick={guardar} disabled={guardando || !s?.name.trim()} className="btn-primary">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {tc('guardar')}
            </button>
          </>
        }
      >
        {s && (
          <div className="space-y-5">
            <div>
              <Pestanas
                etiqueta={t('idioma')}
                valor={idioma}
                onChange={setIdioma}
                opciones={(['es', ...OTROS] as const).map((l) => ({ valor: l, texto: IDIOMAS[l].corto }))}
              />
              <p className="mt-2 text-xs text-muted">{idioma === 'es' ? t('baseEspanol') : t('traduccionAyuda', { idioma: IDIOMAS[idioma].nombre })}</p>
            </div>
            <div className="grid gap-4" dir={idioma === 'ar' ? 'rtl' : undefined} lang={idioma}>
              <label className="block">
                <span className="field-label">{t('nombre')}</span>
                <input className="field" value={texto('name')} onChange={(e) => ponerTexto('name', e.target.value)} placeholder={idioma === 'es' ? '' : s.name} />
              </label>
              <label className="block">
                <span className="field-label">{t('descripcionCorta')}</span>
                <input className="field" value={texto('shortDesc')} onChange={(e) => ponerTexto('shortDesc', e.target.value)} placeholder={idioma === 'es' ? '' : s.shortDesc} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">{t('categoria')}</span>
                <select className="field" value={s.category} onChange={(e) => setS({ ...s, category: e.target.value as ServiceCategory })}>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {tCat(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">{t('duracion')}</span>
                <input type="number" min={5} step={5} className="field" value={s.durationMin} onChange={(e) => setS({ ...s, durationMin: Number(e.target.value) || 30 })} />
              </label>
              <label className="block">
                <span className="field-label">{t('retoque')}</span>
                <input type="number" min={0} className="field" value={s.touchUpDays ?? ''} onChange={(e) => setS({ ...s, touchUpDays: e.target.value ? Number(e.target.value) : null })} placeholder={t('sinRetoque')} />
              </label>
              <label className="block">
                <span className="field-label">{t('precio')}</span>
                <CampoDinero valor={s.priceCents} onChange={(v) => setS({ ...s, priceCents: v })} placeholder={t('consultar')} />
              </label>
              <label className="block">
                <span className="field-label">{t('modoPrecio')}</span>
                <select className="field" value={s.priceMode} onChange={(e) => setS({ ...s, priceMode: e.target.value })}>
                  {(['DESDE', 'POR_UNIDAD', 'FIJO'] as const).map((m) => (
                    <option key={m} value={m}>
                      {tPrecio(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">{t('orden')}</span>
                <input type="number" className="field" value={s.sortOrder} onChange={(e) => setS({ ...s, sortOrder: Number(e.target.value) || 0 })} />
              </label>
              <label className="block sm:col-span-3">
                <span className="field-label">{t('slug')}</span>
                <input className="field" dir="ltr" value={s.slug} onChange={(e) => setS({ ...s, slug: aSlug(e.target.value) })} />
                <span className="mt-1 block text-xs text-muted">{t('slugAyuda')}</span>
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ['active', t('activo')],
                  ['published', t('publicado')],
                  ['featured', t('destacado')],
                ] as const
              ).map(([k, etiqueta]) => (
                <label key={k} className="flex items-center gap-2 rounded-2xl border border-line p-3 text-sm">
                  <input type="checkbox" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} className="h-4 w-4 accent-brand-700" />
                  {etiqueta}
                </label>
              ))}
            </div>
            {fallo && <CajaError mensaje={fallo} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
