'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, FileDown, FileText, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import type { Recibo } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { Contactar } from '@/components/admin/Contactar';
import { confirmar } from '@/components/admin/Dialogo';
import { MarcaNgs } from '@/components/admin/Marca';
import { Pagos } from '@/components/admin/recibos/Pagos';
import { CajaError, CajaOk, Cargando, Ltr, Pastilla, TONO_RECIBO } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

export default function VerRecibo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('panel.recibos');
  const tDoc = useTranslations('estados.documento');
  const tEst = useTranslations('estados.recibo');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const router = useRouter();
  const { usuario } = useUsuario();
  const { datos: d, cargando, error, recargar } = useCarga<Recibo>(`/api/invoices/${id}`);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function estado(accion: 'anular' | 'reabrir' | 'convertir') {
    if (accion === 'anular' && !(await confirmar({ titulo: t('anularTitulo'), mensaje: t('anularMensaje'), aceptar: t('anular'), peligro: true }))) return;
    try {
      await api.patch(`/api/invoices/${id}/estado`, { accion });
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function borrar() {
    setFallo(null);
    try {
      const info = await api.get<{ sePuedeBorrar: boolean; motivo: string | null; numero: string }>(`/api/invoices/${id}/eliminar`);
      if (!info.sePuedeBorrar) {
        setFallo(t(`noSeBorra.${(info.motivo ?? 'vigente') as 'vigente' | 'conPagos' | 'conMovimientos'}`, { numero: info.numero }));
        return;
      }
      if (!(await confirmar({ titulo: t('borrarTitulo'), mensaje: t('borrarMensaje', { numero: info.numero }), aceptar: tc('eliminar'), peligro: true }))) return;
      const r = await api.delete<{ message: string }>(`/api/invoices/${id}/eliminar`);
      setAviso(r.message);
      router.replace('/admin/recibos');
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  if (cargando && !d) return <Cargando />;
  if (error || !d) return <CajaError mensaje={error ?? ''} onReintentar={recargar} />;
  const numero = `${d.series}-${String(d.number).padStart(5, '0')}`;
  const pdf = `/api/invoices/${d.id}/pdf`;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/recibos" className="text-sm font-bold text-muted hover:text-brand-700">
          ← {tc('volverA', { destino: t('titulo') })}
        </Link>
        <div className="flex flex-wrap gap-2">
          <a href={pdf} target="_blank" rel="noopener noreferrer" className="btn-outline px-4 py-2">
            <FileText className="h-4 w-4" aria-hidden />
            PDF
          </a>
          <a href={`${pdf}?descargar=1`} className="btn-outline px-4 py-2">
            <FileDown className="h-4 w-4" aria-hidden />
            {tc('descargar')}
          </a>
          {d.status !== 'ANULADA' && (
            <Link href={`/admin/recibos/${d.id}/editar`} className="btn-primary px-4 py-2">
              <Pencil className="h-4 w-4" aria-hidden />
              {tc('editar')}
            </Link>
          )}
        </div>
      </div>
      {aviso && <CajaOk mensaje={aviso} />}
      {fallo && (
        <div className="mb-4">
          <CajaError mensaje={fallo} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <article className={`hoja card p-6 sm:p-10 ${d.status === 'ANULADA' ? 'opacity-70' : ''}`}>
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
            <div className="flex items-center gap-3">
              <MarcaNgs tamano={44} />
              <div>
                <p className="font-display text-xl text-brand-900">NGS MedSpa</p>
                <p className="text-xs text-muted">Dallas – Fort Worth, TX</p>
              </div>
            </div>
            <div className="text-end">
              <p className="text-xs font-bold uppercase tracking-widest text-muted rtl:tracking-normal">{tDoc(d.type)}</p>
              <p className="font-display text-2xl text-accent-700" dir="ltr">
                {numero}
              </p>
              <Pastilla tono={TONO_RECIBO[d.status]} className="mt-1">
                {tEst(d.status)}
              </Pastilla>
            </div>
          </header>
          <div className="grid gap-4 py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase text-muted">{t('para')}</p>
              <p className="mt-1 font-bold">{d.clientName}</p>
              <p className="text-sm text-muted">
                {d.clientPhone && <Ltr>{d.clientPhone}</Ltr>}
                {d.clientEmail ? ` · ${d.clientEmail}` : ''}
              </p>
            </div>
            <div className="sm:text-end">
              <p className="text-xs font-bold uppercase text-muted">{t('fecha')}</p>
              <p className="mt-1">{fmt.fechaDia(d.issueDate.slice(0, 10), 'larga')}</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-y border-line text-xs uppercase text-muted">
              <tr>
                <th className="py-2 text-start">{t('form.concepto')}</th>
                <th className="py-2 text-end">{t('form.cant')}</th>
                <th className="py-2 text-end">{t('form.precio')}</th>
                <th className="py-2 text-end">{t('form.importe')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.items.map((l) => (
                <tr key={l.id}>
                  <td className="py-3">{l.description}</td>
                  <td className="py-3 text-end">{l.quantity}</td>
                  <td className="py-3 text-end" dir="ltr">
                    {fmt.dinero(l.unitPrice)}
                  </td>
                  <td className="py-3 text-end font-bold" dir="ltr">
                    {fmt.dinero(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ms-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t('form.subtotal')}</dt>
              <dd dir="ltr">{fmt.dinero(d.subtotal)}</dd>
            </div>
            {d.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">{t('form.descuento')}</dt>
                <dd dir="ltr">-{fmt.dinero(d.discount)}</dd>
              </div>
            )}
            {d.tax > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">
                  {t('form.impuesto')} ({fmt.numero(d.taxRateBps / 100, 3)} %)
                </dt>
                <dd dir="ltr">{fmt.dinero(d.tax)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
              <dt>{t('form.total')}</dt>
              <dd dir="ltr">{fmt.dinero(d.total)}</dd>
            </div>
          </dl>
          {d.notes && <p className="mt-6 whitespace-pre-line rounded-2xl bg-cream p-4 text-sm">{d.notes}</p>}
          {d.signature && (
            <div className="mt-8 w-56">
              <img src={d.signature} alt="" className="h-16 object-contain" />
              <p className="border-t border-ink/40 pt-1 text-sm font-bold">{d.signedBy}</p>
            </div>
          )}
        </article>

        <aside className="space-y-4">
          {d.type === 'RECIBO' ? (
            <Pagos key={`${d.id}-${d.balance}`} recibo={d} onCambio={recargar} />
          ) : (
            <section className="card space-y-3 p-5">
              <p className="text-sm text-muted">{t('esCotizacion')}</p>
              {d.status !== 'ANULADA' && (
                <button type="button" onClick={() => estado('convertir')} className="btn-primary w-full">
                  {t('convertir')}
                </button>
              )}
            </section>
          )}
          {d.clientPhone && (
            <section className="card p-5">
              <p className="mb-2 text-sm font-bold">{t('enviar')}</p>
              <p className="mb-3 text-xs text-muted">{t('enviarAyuda')}</p>
              <Contactar compacto telefono={d.clientPhone} correo={d.clientEmail} />
            </section>
          )}
          {usuario.role === 'ADMIN' && (
            <section className="card space-y-2 p-5">
              {d.status === 'ANULADA' ? (
                <button type="button" onClick={() => estado('reabrir')} className="btn-outline w-full">
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  {t('reabrir')}
                </button>
              ) : (
                <button type="button" onClick={() => estado('anular')} className="btn-outline w-full text-red-600">
                  <Ban className="h-4 w-4" aria-hidden />
                  {t('anular')}
                </button>
              )}
              <button type="button" onClick={borrar} className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-muted hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" aria-hidden />
                {t('borrar')}
              </button>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
