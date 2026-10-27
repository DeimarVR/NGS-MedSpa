'use client';

import { Suspense, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Columns2, Images, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import type { RegistroFotos } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { BuscadorClienta, type ClientaElegida } from '@/components/admin/BuscadorClienta';
import { confirmar } from '@/components/admin/Dialogo';
import { Comparador } from '@/components/admin/fotos/Comparador';
import { ANGULOS, RegistroForm } from '@/components/admin/fotos/RegistroForm';
import { CajaError, Cargando, Encabezado, Modal, Pastilla, Vacio } from '@/components/admin/ui';
import { useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

function Visor({ registro, onCerrar, onEditar, onBorrado }: { registro: RegistroFotos | null; onCerrar: () => void; onEditar: () => void; onBorrado: () => void }) {
  const t = useTranslations('panel.fotos');
  const tTipo = useTranslations('estados.foto');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const [comparar, setComparar] = useState(false);
  // Por defecto, la primera «antes» contra la última «después» (se monta de nuevo con cada registro).
  const [a, setA] = useState(() => Math.max(0, registro?.photos.findIndex((f) => f.type === 'ANTES') ?? 0));
  const [b, setB] = useState(() => {
    const despues = registro?.photos.map((f) => f.type).lastIndexOf('DESPUES') ?? -1;
    return despues >= 0 ? despues : Math.min(1, (registro?.photos.length ?? 1) - 1);
  });
  const [grande, setGrande] = useState<string | null>(null);

  async function borrar() {
    if (!registro || !(await confirmar({ titulo: t('borrarTitulo'), mensaje: t('borrarMensaje'), aceptar: tc('eliminar'), peligro: true }))) return;
    await api.delete(`/api/photo-records/${registro.id}`).catch(() => undefined);
    onBorrado();
  }

  const angulo = (x: string) => ((ANGULOS as readonly string[]).includes(x) ? t(`angulos.${x as (typeof ANGULOS)[number]}`) : x);

  return (
    <Modal abierto={Boolean(registro)} titulo={registro?.title ?? ''} onCerrar={onCerrar} ancho="max-w-5xl">
      {registro && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">
              <Link href={`/admin/clientas/${registro.patient.id}`} className="font-bold text-ink hover:text-brand-600">
                {registro.patient.fullName}
              </Link>{' '}
              · {fmt.fechaCorta(registro.createdAt)}
              {registro.publishable && (
                <Pastilla tono="verde" className="ms-2">
                  {t('sePuedePublicar')}
                </Pastilla>
              )}
            </p>
            <div className="flex gap-2">
              {registro.photos.length >= 2 && (
                <button type="button" onClick={() => setComparar((v) => !v)} className={`${comparar ? 'btn-primary' : 'btn-outline'} px-4 py-2`}>
                  <Columns2 className="h-4 w-4" aria-hidden />
                  {t('comparar')}
                </button>
              )}
              <button type="button" onClick={onEditar} className="btn-outline px-4 py-2">
                <Pencil className="h-4 w-4" aria-hidden />
                {tc('editar')}
              </button>
              {usuario.role === 'ADMIN' && (
                <button type="button" onClick={borrar} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('eliminar')}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
          {registro.notes && <p className="rounded-2xl bg-cream p-3 text-sm">{registro.notes}</p>}
          {comparar && registro.photos.length >= 2 ? (
            <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
              <Comparador antes={registro.photos[a].url} despues={registro.photos[b].url} etiquetaAntes={tTipo(registro.photos[a].type)} etiquetaDespues={tTipo(registro.photos[b].type)} />
              <div className="space-y-3">
                {[
                  [a, setA, t('izquierda')],
                  [b, setB, t('derecha')],
                ].map(([valor, poner, etiqueta]) => (
                  <label key={etiqueta as string} className="block">
                    <span className="field-label">{etiqueta as string}</span>
                    <select className="field" value={valor as number} onChange={(e) => (poner as (n: number) => void)(Number(e.target.value))}>
                      {registro.photos.map((f, i) => (
                        <option key={f.id} value={i}>
                          {i + 1}. {tTipo(f.type)} · {angulo(f.angle)} · {fmt.fechaCorta(f.takenAt)}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : grande ? (
            <button type="button" onClick={() => setGrande(null)} className="block w-full">
              <img src={grande} alt="" className="mx-auto max-h-[70vh] rounded-2xl object-contain" />
            </button>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {registro.photos.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setGrande(f.url)} className="group block w-full text-start">
                    <img src={f.url} alt={f.caption ?? ''} className="aspect-[3/4] w-full rounded-2xl bg-cream object-cover transition-opacity group-hover:opacity-90" />
                    <span className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Pastilla tono={f.type === 'ANTES' ? 'gris' : f.type === 'DESPUES' ? 'verde' : 'azul'}>{tTipo(f.type)}</Pastilla>
                      <span className="text-xs text-muted">
                        {angulo(f.angle)} · {fmt.fechaCorta(f.takenAt)}
                      </span>
                    </span>
                    {f.caption && <span className="block text-xs text-muted">{f.caption}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function Fotos() {
  const t = useTranslations('panel.fotos');
  const fmt = useFormato();
  const { nombre, tratamientos } = useTratamientos(false);
  const { leer, poner } = useParametros();
  const clientaId = leer('clienta');
  const cargaClienta = useCarga<ClientaElegida>(clientaId ? `/api/patients/${clientaId}` : null);
  const clienta = clientaId && cargaClienta.datos?.id === clientaId ? cargaClienta.datos : null;
  const [soloPublicables, setSoloPublicables] = useState(false);
  const [editando, setEditando] = useState<RegistroFotos | 'nuevo' | null>(null);
  const [viendo, setViendo] = useState<RegistroFotos | null>(null);
  const { datos, cargando, error, recargar } = useCarga<{ items: RegistroFotos[] }>(
    `/api/photo-records?take=100${clientaId ? `&patientId=${clientaId}` : ''}${soloPublicables ? '&publicables=true' : ''}`,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button type="button" onClick={() => setEditando('nuevo')} className="btn-grad">
          <Plus className="h-4 w-4" aria-hidden />
          {t('nuevoRegistro')}
        </button>
      </Encabezado>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <BuscadorClienta elegida={clienta} onElegir={(c) => poner({ clienta: c?.id ?? null })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloPublicables} onChange={(e) => setSoloPublicables(e.target.checked)} className="h-4 w-4 accent-brand-700" />
          {t('soloPublicables')}
        </label>
      </div>
      {(error || cargaClienta.error) && <CajaError mensaje={error ?? cargaClienta.error ?? ''} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<Images className="h-5 w-5" aria-hidden />} titulo={t('vacio')} texto={t('vacioTexto')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datos.items.map((r) => {
            const portada = r.photos.find((f) => f.type === 'DESPUES') ?? r.photos[0];
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setViendo(r)} className="card group block w-full overflow-hidden text-start">
                  <div className="relative aspect-[4/3] bg-cream">
                    {portada ? <img src={portada.url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <Images className="absolute inset-0 m-auto h-8 w-8 text-brand-200" aria-hidden />}
                    <span className="absolute end-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-bold text-white">{t('nFotos', { n: r.photos.length })}</span>
                  </div>
                  <div className="p-4">
                    <p className="truncate font-bold">{r.title}</p>
                    <p className="truncate text-sm text-muted">
                      {r.patient.fullName}
                      {r.serviceId ? ` · ${nombre(tratamientos.find((s) => s.id === r.serviceId)) || r.service?.name}` : ''}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted">{fmt.fechaCorta(r.createdAt)}</span>
                      {r.publishable && <Pastilla tono="verde">{t('sePuedePublicar')}</Pastilla>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Visor
        key={viendo?.id ?? 'ninguno'}
        registro={viendo}
        onCerrar={() => setViendo(null)}
        onEditar={() => {
          setEditando(viendo);
          setViendo(null);
        }}
        onBorrado={() => {
          setViendo(null);
          recargar();
        }}
      />
      <RegistroForm
        abierto={editando !== null}
        registro={editando === 'nuevo' ? null : editando}
        clientaInicial={clienta}
        onCerrar={() => setEditando(null)}
        onGuardado={(r) => {
          setEditando(null);
          recargar();
          setViendo(r);
        }}
      />
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <Fotos />
    </Suspense>
  );
}
