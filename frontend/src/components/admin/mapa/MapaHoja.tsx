'use client';

import { useTranslations } from 'next-intl';
import { useTratamientos } from '@/lib/tratamientos';
import { useFormato } from '@/lib/useFormato';
import type { FaceView, MapaFacial } from '@/lib/types';
import { Dato, Ltr } from '../ui';
import { Rostro } from './Rostro';
import { esZona } from './zonas';

/** El mapa facial en limpio: para mirarlo, imprimirlo o dárselo a la clienta. */
export function MapaHoja({ mapa }: { mapa: MapaFacial }) {
  const t = useTranslations('panel.mapa');
  const tZona = useTranslations('panel.mapa.zonas');
  const tVista = useTranslations('estados.vista');
  const fmt = useFormato();
  const { tratamientos, nombre } = useTratamientos(false);
  const servicio = (id: string | null) => (id ? nombre(tratamientos.find((s) => s.id === id)) : '');

  const vistas = (['FRENTE', 'PERFIL_IZQ', 'PERFIL_DER'] as FaceView[]).filter((v) => v === 'FRENTE' || mapa.entries.some((e) => e.view === v));
  const numerados = mapa.entries.map((e, i) => ({ ...e, numero: i + 1 }));
  const totales = new Map<string, { nombre: string; unidad: string; total: number }>();
  for (const e of mapa.entries) {
    const k = `${e.productName}|${e.unit}`;
    const x = totales.get(k) ?? { nombre: e.productName, unidad: e.unit, total: 0 };
    x.total = Math.round((x.total + e.quantity) * 1000) / 1000;
    totales.set(k, x);
  }

  return (
    <article className="hoja card space-y-6 p-6 sm:p-8">
      <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{t('hoja')}</p>
          <h1 className="mt-3 text-3xl text-brand-900">{mapa.patientName}</h1>
          <p className="mt-1 text-sm text-muted">
            {fmt.fechaDia(mapa.procedureDate.slice(0, 10), 'larga')}
            {mapa.serviceId ? ` · ${servicio(mapa.serviceId) || mapa.service?.name}` : ''}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Dato etiqueta={t('telefono')}>
            <Ltr>{fmt.telefono(mapa.patientPhone)}</Ltr>
          </Dato>
          <Dato etiqueta={t('edad')}>{mapa.patientAge !== null ? t('anios', { n: mapa.patientAge }) : null}</Dato>
        </dl>
      </header>

      <div className={`grid gap-4 ${vistas.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'mx-auto max-w-sm'}`}>
        {vistas.map((v) => (
          <figure key={v}>
            <Rostro
              vista={v}
              foto={mapa.facePhotoUrl}
              puntos={numerados.filter((e) => e.view === v).map((e) => ({ clave: e.id, x: e.x, y: e.y, numero: e.numero, kind: e.product?.kind ?? null }))}
              etiqueta={tVista(v)}
            />
            <figcaption className="mt-1 text-center text-xs font-bold text-muted">{tVista(v)}</figcaption>
          </figure>
        ))}
      </div>

      {mapa.entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-cream text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 text-start">#</th>
                <th className="px-3 py-2 text-start">{t('zona')}</th>
                <th className="px-3 py-2 text-start">{t('producto')}</th>
                <th className="px-3 py-2 text-start">{t('lote')}</th>
                <th className="px-3 py-2 text-end">{t('cantidad')}</th>
                <th className="px-3 py-2 text-start">{t('tecnica')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {numerados.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-bold">{e.numero}</td>
                  <td className="px-3 py-2">
                    {esZona(e.zone) ? tZona(e.zone) : e.zone}
                    <span className="block text-xs text-muted">{tVista(e.view)}</span>
                  </td>
                  <td className="px-3 py-2">{e.productName}</td>
                  <td className="px-3 py-2">
                    {e.lotNumber ?? '—'}
                    {e.expiresAt && <span className="block text-xs text-muted">{t('vence')} {fmt.fechaCorta(e.expiresAt)}</span>}
                  </td>
                  <td className="px-3 py-2 text-end font-bold">
                    {fmt.numero(e.quantity, 2)} {e.unit}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {e.technique}
                    {e.notes && <span className="block text-xs">{e.notes}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {[...totales.values()].map((x) => (
                <tr key={`${x.nombre}${x.unidad}`} className="bg-cream/60">
                  <td colSpan={4} className="px-3 py-2 text-end text-xs font-bold uppercase text-muted">
                    {t('totalDe', { producto: x.nombre })}
                  </td>
                  <td className="px-3 py-2 text-end font-bold">
                    {fmt.numero(x.total, 2)} {x.unidad}
                  </td>
                  <td />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {mapa.aftercare && (
          <div>
            <p className="field-label">{t('indicaciones')}</p>
            <p className="whitespace-pre-line rounded-2xl bg-cream p-4 text-sm">{mapa.aftercare}</p>
          </div>
        )}
        {mapa.notes && (
          <div className="no-imprimir">
            <p className="field-label">{t('notas')}</p>
            <p className="whitespace-pre-line rounded-2xl border border-line p-4 text-sm">{mapa.notes}</p>
          </div>
        )}
        {mapa.nextControl && (
          <div>
            <p className="field-label">{t('proximoControl')}</p>
            <p className="text-sm">
              {fmt.fechaDia(mapa.nextControl.slice(0, 10), 'larga')}
              {mapa.nextControlTime ? ` · ${mapa.nextControlTime}` : ''}
              {mapa.nextControlServiceId ? ` · ${servicio(mapa.nextControlServiceId)}` : ''}
            </p>
            {mapa.nextControlAppointment && <p className="text-xs text-emerald-700">{t('controlAgendado')}</p>}
          </div>
        )}
      </div>

      <div className="grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
        {[
          { firma: mapa.professionalSignature, etiqueta: t('firmaProfesional'), nombre: mapa.createdBy?.fullName },
          { firma: mapa.patientSignature, etiqueta: t('firmaClienta'), nombre: mapa.patientName },
        ].map((f) => (
          <div key={f.etiqueta}>
            <div className="flex h-24 items-end border-b border-ink/40">{f.firma && <img src={f.firma} alt="" className="max-h-24 object-contain" />}</div>
            <p className="mt-1 text-sm font-bold">{f.nombre}</p>
            <p className="text-xs text-muted">{f.etiqueta}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
