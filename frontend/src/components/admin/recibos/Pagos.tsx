'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import { METODOS_PAGO, type PaymentMethod, type Recibo } from '@/lib/types';
import { useUsuario } from '../AuthGuard';
import { CampoDinero } from '../CampoDinero';
import { confirmar } from '../Dialogo';
import { CajaError } from '../ui';
import { mensajeDe } from '../useCarga';

/** Los pagos de un recibo: la lista y el formulario para registrar uno. */
export function Pagos({ recibo, onCambio }: { recibo: Recibo; onCambio: () => void }) {
  const t = useTranslations('panel.recibos.pagos');
  const tPago = useTranslations('estados.pago');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const [monto, setMonto] = useState<number | null>(recibo.balance || null);
  const [medio, setMedio] = useState<PaymentMethod>('TARJETA');
  const [fecha, setFecha] = useState(fmt.hoy());
  const [referencia, setReferencia] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    api
      .get<{ cerrado: boolean }>(`/api/caja/dia?fecha=${fecha}`)
      .then((d) => setCerrado(d.cerrado))
      .catch(() => setCerrado(false));
  }, [fecha]);

  async function registrar() {
    if (!monto) return;
    setGuardando(true);
    setError(null);
    try {
      const hora = fecha === fmt.hoy() ? fmt.horaEnClinica(new Date()) : '12:00';
      await api.post(`/api/invoices/${recibo.id}/pagos`, { amount: monto, method: medio, fecha, hora, reference: referencia || null, receivedBy: usuario.fullName });
      setReferencia('');
      onCambio();
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string, cuanto: number) {
    if (!(await confirmar({ titulo: t('borrarTitulo'), mensaje: t('borrarMensaje', { monto: fmt.dinero(cuanto) }), aceptar: tc('eliminar'), peligro: true }))) return;
    try {
      await api.delete(`/api/invoices/${recibo.id}/pagos?pagoId=${id}`);
      onCambio();
    } catch (e) {
      setError(mensajeDe(e));
    }
  }

  const puedeCobrar = recibo.type === 'RECIBO' && recibo.status !== 'ANULADA' && recibo.balance > 0;

  return (
    <section className="card p-5">
      <h2 className="text-lg">{t('titulo')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-cream p-3 text-sm">
        <div>
          <p className="text-xs text-muted">{t('pagado')}</p>
          <p className="font-bold text-emerald-700" dir="ltr">
            {fmt.dinero(recibo.deposit)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t('saldo')}</p>
          <p className={`font-bold ${recibo.balance > 0 ? 'text-amber-700' : ''}`} dir="ltr">
            {fmt.dinero(recibo.balance)}
          </p>
        </div>
      </div>
      {recibo.payments.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {recibo.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <div>
                <p className="font-bold">
                  <span dir="ltr">{fmt.dinero(p.amount)}</span> · {tPago(p.method)}
                </p>
                <p className="text-xs text-muted">
                  {fmt.fechaHora(p.paidAt)}
                  {p.reference ? ` · ${p.reference}` : ''}
                  {p.createdBy?.fullName ? ` · ${p.createdBy.fullName}` : ''}
                </p>
              </div>
              {usuario.role === 'ADMIN' && (
                <button type="button" onClick={() => borrar(p.id, p.amount)} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('eliminar')}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puedeCobrar && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-sm font-bold">{t('registrar')}</p>
          <div className="grid grid-cols-2 gap-2">
            <CampoDinero valor={monto} onChange={setMonto} aria-label={t('monto')} />
            <select className="field" value={medio} onChange={(e) => setMedio(e.target.value as PaymentMethod)} aria-label={t('medio')}>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {tPago(m)}
                </option>
              ))}
            </select>
            <input type="date" className="field" value={fecha} max={fmt.hoy()} onChange={(e) => setFecha(e.target.value)} aria-label={t('fecha')} />
            <input className="field" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={t('referencia')} />
          </div>
          {cerrado && (
            <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {t('diaCerrado')}
            </p>
          )}
          {error && <CajaError mensaje={error} />}
          <button type="button" onClick={registrar} disabled={!monto || guardando || cerrado} className="btn-primary w-full">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t('cobrar', { monto: fmt.dinero(monto ?? 0) })}
          </button>
        </div>
      )}
    </section>
  );
}
