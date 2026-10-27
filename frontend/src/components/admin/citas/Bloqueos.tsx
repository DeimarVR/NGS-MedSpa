'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { aInstante } from '@/lib/format';
import { useFormato } from '@/lib/useFormato';
import { confirmar } from '../Dialogo';
import { CajaError, Cargando, Modal } from '../ui';
import { mensajeDe, useCarga } from '../useCarga';

interface Bloqueo {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}
interface Afectada {
  id: string;
  contactName: string;
  startsAt: string;
  service: { name: string };
}

/** Bloquear días u horas (feriados, vacaciones, cursos) y ver los bloqueos que vienen. */
export function Bloqueos({ abierto, onCerrar, onCambio }: { abierto: boolean; onCerrar: () => void; onCambio: () => void }) {
  const t = useTranslations('panel.citas.bloqueos');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { datos, cargando, error, recargar } = useCarga<{ items: Bloqueo[] }>(abierto ? '/api/blackouts' : null);
  const [desde, setDesde] = useState(fmt.hoy());
  const [hasta, setHasta] = useState(fmt.hoy());
  const [todoElDia, setTodoElDia] = useState(true);
  const [horaDesde, setHoraDesde] = useState('10:00');
  const [horaHasta, setHoraHasta] = useState('13:00');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [afectadas, setAfectadas] = useState<Afectada[] | null>(null);

  async function crear() {
    setGuardando(true);
    setFallo(null);
    setAfectadas(null);
    try {
      const inicio = aInstante(desde, todoElDia ? '00:00' : horaDesde, fmt.zona);
      const fin = todoElDia ? aInstante(hasta, '23:59', fmt.zona) : aInstante(hasta, horaHasta, fmt.zona);
      const r = await api.post<{ afectadas: Afectada[] }>('/api/blackouts', { startsAt: inicio.toISOString(), endsAt: fin.toISOString(), reason: motivo || null });
      setAfectadas(r.afectadas);
      setMotivo('');
      recargar();
      onCambio();
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(b: Bloqueo) {
    if (!(await confirmar({ titulo: t('quitarTitulo'), mensaje: t('quitarMensaje'), aceptar: tc('quitar') }))) return;
    try {
      await api.delete(`/api/blackouts/${b.id}`);
      recargar();
      onCambio();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  return (
    <Modal abierto={abierto} titulo={t('titulo')} onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 text-sm text-muted">{t('texto')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">{tc('desde')}</span>
              <input type="date" className="field" value={desde} onChange={(e) => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value); }} />
            </label>
            <label className="block">
              <span className="field-label">{tc('hasta')}</span>
              <input type="date" className="field" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} className="h-4 w-4 accent-brand-700" />
            {t('todoElDia')}
          </label>
          {!todoElDia && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="field-label">{t('horaDesde')}</span>
                <input type="time" className="field" value={horaDesde} onChange={(e) => setHoraDesde(e.target.value)} />
              </label>
              <label className="block">
                <span className="field-label">{t('horaHasta')}</span>
                <input type="time" className="field" value={horaHasta} onChange={(e) => setHoraHasta(e.target.value)} />
              </label>
            </div>
          )}
          <label className="mt-3 block">
            <span className="field-label">{t('motivo')}</span>
            <input className="field" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t('motivoEjemplo')} maxLength={160} />
          </label>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={crear} disabled={guardando} className="btn-primary">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}
              {t('bloquear')}
            </button>
          </div>
          {fallo && (
            <div className="mt-3">
              <CajaError mensaje={fallo} />
            </div>
          )}
          {afectadas && afectadas.length > 0 && (
            <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-bold">{t('afectadas', { n: afectadas.length })}</p>
              <ul className="mt-1 list-inside list-disc">
                {afectadas.map((a) => (
                  <li key={a.id}>
                    {fmt.fechaHora(a.startsAt)} · {a.contactName} · {a.service.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">{t('proximos')}</p>
          {cargando && !datos ? (
            <Cargando />
          ) : error ? (
            <CajaError mensaje={error} onReintentar={recargar} />
          ) : !datos?.items.length ? (
            <p className="rounded-2xl bg-cream px-4 py-5 text-center text-sm text-muted">{t('ninguno')}</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {datos.items.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-bold">
                      {fmt.fechaHora(b.startsAt)} → {fmt.fechaHora(b.endsAt)}
                    </p>
                    {b.reason && <p className="text-muted">{b.reason}</p>}
                  </div>
                  <button type="button" onClick={() => quitar(b)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('quitar')}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
