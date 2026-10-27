'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, FileDown, FileSignature, Loader2, Settings } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { aLocale, IDIOMAS } from '@/lib/idiomas';
import { useFormato } from '@/lib/useFormato';
import type { ConsentimientoFirmado, PlantillaConsentimiento } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { BuscadorClienta, type ClientaElegida } from '@/components/admin/BuscadorClienta';
import { FirmaPad } from '@/components/admin/FirmaPad';
import { TextoConsentimiento } from '@/components/admin/TextoConsentimiento';
import { CajaError, Cargando, Encabezado, Pastilla, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

function Firmar() {
  const t = useTranslations('panel.consentimientos');
  const tKind = useTranslations('estados.consentimiento');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const { leer, poner } = useParametros();
  const clientaId = leer('clienta');
  const cargaClienta = useCarga<ClientaElegida>(clientaId ? `/api/patients/${clientaId}` : null);
  const clienta = clientaId && cargaClienta.datos?.id === clientaId ? cargaClienta.datos : null;
  const [plantilla, setPlantilla] = useState<PlantillaConsentimiento | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [notas, setNotas] = useState('');
  const [profesional, setProfesional] = useState(usuario.fullName);
  const [leido, setLeido] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<ConsentimientoFirmado | null>(null);

  const plantillas = useCarga<{ items: PlantillaConsentimiento[] }>('/api/consentimientos');
  const firmados = useCarga<{ items: ConsentimientoFirmado[] }>(`/api/consentimientos/firmas?take=40${clientaId ? `&patientId=${clientaId}` : ''}`);

  function abrir(p: PlantillaConsentimiento) {
    setPlantilla(p);
    setFirma(null);
    setNotas('');
    setLeido(false);
    setError(null);
    setHecho(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function firmar() {
    if (!clienta || !plantilla || !firma) return;
    setFirmando(true);
    setError(null);
    try {
      const r = await api.post<ConsentimientoFirmado>('/api/consentimientos/firmas', {
        templateId: plantilla.id,
        patientId: clienta.id,
        signature: firma,
        templateVersion: plantilla.version,
        professionalName: profesional,
        notes: notas || null,
      });
      setHecho(r);
      setPlantilla(null);
      firmados.recargar();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setFirmando(false);
    }
  }

  const idiomaClienta = clienta ? aLocale(clienta.preferredLocale) : null;
  const sugerido = idiomaClienta && ['es', 'en', 'fr'].includes(idiomaClienta) ? idiomaClienta : 'en';
  const lista = (plantillas.datos?.items ?? []).slice().sort((a, b) => Number(aLocale(b.locale) === sugerido) - Number(aLocale(a.locale) === sugerido));

  if (plantilla && clienta) {
    return (
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => setPlantilla(null)} className="mb-4 text-sm font-bold text-muted hover:text-brand-700">
          ← {tc('volver')}
        </button>
        <article className="card overflow-hidden">
          <header className="border-b border-line bg-cream px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <Pastilla tono="oro">{tKind(plantilla.kind)}</Pastilla>
              <Pastilla tono="gris">{IDIOMAS[aLocale(plantilla.locale)].nombre}</Pastilla>
              <span className="text-xs text-muted">{t('version', { n: plantilla.version })}</span>
            </div>
            <h1 className="mt-3 text-2xl text-brand-900">{plantilla.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {t('para', { nombre: clienta.fullName })} · {fmt.fechaLarga(new Date())}
            </p>
          </header>
          <div className="max-h-[55vh] overflow-y-auto px-6 py-6 sm:px-8" onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setLeido(true); }}>
            <TextoConsentimiento texto={plantilla.body} />
          </div>
          <div className="space-y-5 border-t border-line px-6 py-6 sm:px-8">
            <label className="flex items-start gap-3 rounded-2xl bg-accent-100/60 p-4 text-sm">
              <input type="checkbox" checked={leido} onChange={(e) => setLeido(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" />
              <span>{t('declaracion')}</span>
            </label>
            <div>
              <p className="field-label">{t('firmaClienta', { nombre: clienta.fullName })}</p>
              <FirmaPad valor={firma} onCambio={setFirma} alto="h-44" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">{t('atendidaPor')}</span>
                <input className="field" value={profesional} onChange={(e) => setProfesional(e.target.value)} />
              </label>
              <label className="block">
                <span className="field-label">{t('observaciones')}</span>
                <input className="field" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('observacionesEjemplo')} />
              </label>
            </div>
            {error && <CajaError mensaje={error} />}
            <button type="button" onClick={firmar} disabled={!firma || !leido || firmando} className="btn-grad w-full py-4 text-base">
              {firmando ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <FileSignature className="h-5 w-5" aria-hidden />}
              {t('firmarGuardar')}
            </button>
            <p className="text-center text-xs text-muted">{t('cerrado')}</p>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        {usuario.role === 'ADMIN' && (
          <Link href="/admin/configuracion/consentimientos" className="btn-outline">
            <Settings className="h-4 w-4" aria-hidden />
            {t('editarTextos')}
          </Link>
        )}
      </Encabezado>

      {hecho && (
        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-bold text-emerald-800">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            {t('firmado', { nombre: hecho.templateName })}
          </p>
          <a href={hecho.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-4 py-2">
            <FileDown className="h-4 w-4" aria-hidden />
            {t('verPdf')}
          </a>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-1 text-lg">{t('paso1')}</h2>
          <p className="mb-4 text-sm text-muted">{t('paso1Texto')}</p>
          <BuscadorClienta elegida={clienta} onElegir={(c) => poner({ clienta: c?.id ?? null })} />
          <h2 className="mb-1 mt-8 text-lg">{t('paso2')}</h2>
          <p className="mb-4 text-sm text-muted">{clienta ? t('paso2Texto', { idioma: IDIOMAS[sugerido].nombre }) : t('eligeClientaPrimero')}</p>
          {plantillas.cargando && !plantillas.datos ? (
            <Cargando />
          ) : plantillas.error ? (
            <CajaError mensaje={plantillas.error} onReintentar={plantillas.recargar} />
          ) : !lista.length ? (
            <Vacio titulo={t('sinPlantillas')} />
          ) : (
            <ul className="grid gap-2">
              {lista.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!clienta}
                    onClick={() => abrir(p)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      aLocale(p.locale) === sugerido && clienta ? 'border-accent-300 bg-accent-100/40 hover:bg-accent-100' : 'border-line hover:bg-brand-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{p.name}</span>
                      {p.description && <span className="block truncate text-xs text-muted">{p.description}</span>}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <Pastilla tono="oro">{tKind(p.kind)}</Pastilla>
                      <Pastilla tono="gris">{IDIOMAS[aLocale(p.locale)].corto}</Pastilla>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg">{clienta ? t('firmadosDe', { nombre: clienta.fullName }) : t('recientes')}</h2>
          {firmados.cargando && !firmados.datos ? (
            <Cargando />
          ) : !firmados.datos?.items.length ? (
            <p className="rounded-2xl bg-cream px-4 py-6 text-center text-sm text-muted">{t('ningunoFirmado')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {firmados.datos.items.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{f.templateName}</p>
                    <p className="text-xs text-muted">
                      {clienta ? '' : `${f.patient.fullName} · `}
                      {fmt.fechaHora(f.signedAt)} · v{f.templateVersion}
                    </p>
                  </div>
                  <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-brand-50">
                    <FileDown className="h-3.5 w-3.5" aria-hidden />
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Firmar />
    </Suspense>
  );
}
