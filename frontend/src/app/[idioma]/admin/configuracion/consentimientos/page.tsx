'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Archive, Eye, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { IDIOMAS, aLocale } from '@/lib/idiomas';
import { useTratamientos } from '@/lib/tratamientos';
import type { ConsentKind, PlantillaConsentimiento } from '@/lib/types';
import { confirmar } from '@/components/admin/Dialogo';
import { TextoConsentimiento } from '@/components/admin/TextoConsentimiento';
import { CajaError, Cargando, Encabezado, Modal, Pastilla } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

const KINDS: ConsentKind[] = ['TOXINA', 'RELLENO', 'FOTOS', 'GENERAL'];
interface Form {
  id?: string;
  name: string;
  description: string;
  kind: ConsentKind;
  locale: 'es' | 'en' | 'fr';
  body: string;
  serviceIds: string[];
}

export default function TextosConsentimiento() {
  const t = useTranslations('panel.config.consentimientos');
  const tKind = useTranslations('estados.consentimiento');
  const tc = useTranslations('comun');
  const { tratamientos } = useTratamientos();
  const { datos, cargando, error, recargar } = useCarga<{ items: PlantillaConsentimiento[] }>('/api/consentimientos?incluirInactivas=true');
  const [f, setF] = useState<Form | null>(null);
  const [vista, setVista] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  function abrir(p: PlantillaConsentimiento | null) {
    setFallo(null);
    setVista(false);
    setF(
      p
        ? { id: p.id, name: p.name, description: p.description ?? '', kind: p.kind, locale: aLocale(p.locale) as Form['locale'], body: p.body, serviceIds: p.services.map((s) => s.id) }
        : { name: '', description: '', kind: 'GENERAL', locale: 'en', body: '', serviceIds: [] },
    );
  }

  async function guardar() {
    if (!f) return;
    setGuardando(true);
    setFallo(null);
    const { id, ...cuerpo } = f;
    try {
      if (id) await api.put(`/api/consentimientos/${id}`, cuerpo);
      else await api.post('/api/consentimientos', cuerpo);
      setF(null);
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  async function archivar(p: PlantillaConsentimiento, activa: boolean) {
    try {
      await api.delete(`/api/consentimientos/${p.id}?activa=${activa}`);
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function borrar(p: PlantillaConsentimiento) {
    if (!(await confirmar({ titulo: t('borrarTitulo'), mensaje: t('borrarMensaje'), aceptar: tc('eliminar'), peligro: true }))) return;
    try {
      await api.delete(`/api/consentimientos/${p.id}?definitivo=true`);
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
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
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t('avisoLegal')}</div>
      {(error || fallo) && <CajaError mensaje={error ?? fallo ?? ''} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : (
        <ul className="card divide-y divide-line">
          {datos?.items.map((p) => (
            <li key={p.id} className={`flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${p.active ? '' : 'opacity-60'}`}>
              <button type="button" onClick={() => abrir(p)} className="min-w-0 text-start">
                <span className="block truncate font-bold hover:text-brand-600">{p.name}</span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  <Pastilla tono="oro">{tKind(p.kind)}</Pastilla>
                  <Pastilla tono="gris">{IDIOMAS[aLocale(p.locale)].nombre}</Pastilla>
                  <span className="text-xs text-muted">
                    v{p.version} · {t('firmas', { n: p._count?.signatures ?? 0 })}
                  </span>
                  {!p.active && <Pastilla tono="gris">{t('archivado')}</Pastilla>}
                </span>
              </button>
              <div className="flex shrink-0 gap-1">
                {p.active ? (
                  <button type="button" onClick={() => archivar(p, false)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-brand-50">
                    <Archive className="h-3.5 w-3.5" aria-hidden />
                    {t('archivar')}
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => archivar(p, true)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-brand-50">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      {t('reactivar')}
                    </button>
                    <button type="button" onClick={() => borrar(p)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('eliminar')}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        abierto={f !== null}
        titulo={f?.id ? t('editar') : t('nuevo')}
        onCerrar={() => setF(null)}
        ancho="max-w-4xl"
        pie={
          <>
            <button type="button" onClick={() => setVista((v) => !v)} className="btn-ghost me-auto">
              <Eye className="h-4 w-4" aria-hidden />
              {vista ? t('editarTexto') : t('verComoClienta')}
            </button>
            <button type="button" onClick={() => setF(null)} className="btn-outline">
              {tc('cancelar')}
            </button>
            <button type="button" onClick={guardar} disabled={guardando} className="btn-primary">
              {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {tc('guardar')}
            </button>
          </>
        }
      >
        {f &&
          (vista ? (
            <div className="rounded-2xl border border-line p-6">
              <h2 className="mb-4 text-2xl">{f.name}</h2>
              <TextoConsentimiento texto={f.body} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="field-label">{t('nombre')}</span>
                  <input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                </label>
                <label className="block">
                  <span className="field-label">{t('tipo')}</span>
                  <select className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ConsentKind })}>
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {tKind(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">{t('idioma')}</span>
                  <select className="field" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value as Form['locale'] })}>
                    {(['es', 'en', 'fr'] as const).map((l) => (
                      <option key={l} value={l}>
                        {IDIOMAS[l].nombre}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted">{t('idiomaAyuda')}</span>
                </label>
                <label className="block sm:col-span-2">
                  <span className="field-label">{t('descripcion')}</span>
                  <input className="field" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="field-label">{t('texto')}</span>
                <textarea className="field min-h-80 font-mono text-sm" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} lang={f.locale} />
                <span className="mt-1 block text-xs text-muted">{t('formato')}</span>
              </label>
              <div>
                <span className="field-label">{t('tratamientos')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {tratamientos.map((s) => {
                    const si = f.serviceIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={si}
                        onClick={() => setF({ ...f, serviceIds: si ? f.serviceIds.filter((x) => x !== s.id) : [...f.serviceIds, s.id] })}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold ${si ? 'border-accent-500 bg-accent-100 text-accent-700' : 'border-line text-muted hover:bg-brand-50'}`}
                      >
                        {s.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
              {f.id && <p className="text-xs text-muted">{t('versionAyuda')}</p>}
              {fallo && <CajaError mensaje={fallo} />}
            </div>
          ))}
      </Modal>
    </div>
  );
}
