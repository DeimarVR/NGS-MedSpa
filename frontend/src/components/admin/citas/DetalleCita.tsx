'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, ClipboardList, Copy, FileSignature, Link2, Loader2, Receipt, Sparkles, UserPlus, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { IDIOMAS, localeDeEnum } from '@/lib/idiomas';
import { useFormato } from '@/lib/useFormato';
import type { AppointmentListItem, AppointmentStatus } from '@/lib/types';
import { useUsuario } from '../AuthGuard';
import { BuscadorClienta } from '../BuscadorClienta';
import { Contactar } from '../Contactar';
import { confirmar } from '../Dialogo';
import { CajaError, Cargando, Dato, Ltr, Modal, Pastilla, TONO_CITA } from '../ui';
import { mensajeDe, useCarga } from '../useCarga';
import { SelectorHorario } from './SelectorHorario';

interface Detalle {
  appointment: AppointmentListItem & {
    patient: { id: string; fullName: string; publicToken: string; phone: string; email: string | null } | null;
  };
  manageUrl: string;
}

export function DetalleCita({ id, onCerrar, onCambio }: { id: string | null; onCerrar: () => void; onCambio: () => void }) {
  const t = useTranslations('panel.citas.detalle');
  const tEstado = useTranslations('estados.cita');
  const tOrigen = useTranslations('estados.origen');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const { datos, cargando, error, recargar } = useCarga<Detalle>(id ? `/api/appointments/${id}` : null);
  const [texto, setTexto] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const [dia, setDia] = useState(fmt.hoy());
  const [hora, setHora] = useState<string | null>(null);
  const [enlazando, setEnlazando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cita = datos?.appointment;

  useEffect(() => {
    if (!cita) return;
    const tipo = cita.status === 'PENDIENTE' ? 'confirmacion' : 'recordatorio';
    api
      .get<{ texto: string }>(`/api/appointments/${cita.id}/recordatorio?tipo=${tipo}`)
      .then((r) => setTexto(r.texto))
      .catch(() => setTexto(''));
  }, [cita, fmt]);

  async function hacer(accion: () => Promise<unknown>) {
    setTrabajando(true);
    setFallo(null);
    try {
      await accion();
      recargar();
      onCambio();
    } catch (e) {
      setFallo(mensajeDe(e));
    } finally {
      setTrabajando(false);
    }
  }

  async function cambiarEstado(status: AppointmentStatus) {
    if (!cita) return;
    if (status === 'CANCELADA' && !(await confirmar({ titulo: t('cancelarTitulo'), mensaje: t('cancelarMensaje', { nombre: cita.contactName }), aceptar: t('cancelarSi'), peligro: true }))) return;
    await hacer(() => api.patch(`/api/appointments/${cita.id}/status`, { status }));
  }

  async function mover() {
    if (!cita || !hora) return;
    const [h, m] = hora.split(':').map(Number);
    // La hora elegida es de la clínica: el servidor la recibe ya convertida a instante.
    const instante = await api.get<{ days: Array<{ slots: Array<{ time: string; startsAt: string }> }> }>(
      `/api/availability?serviceId=${cita.service.id}&from=${dia}&days=1&excluir=${cita.id}`,
    );
    const slot = instante.days[0]?.slots.find((s) => s.time === `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    if (!slot) return;
    await hacer(() => api.patch(`/api/appointments/${cita.id}/reschedule`, { startsAt: slot.startsAt, quedaConfirmada: true }));
    setMoviendo(false);
  }

  async function crearFicha() {
    if (!cita) return;
    await hacer(async () => {
      const nueva = await api.post<{ id: string }>('/api/patients', {
        fullName: cita.contactName,
        phone: cita.contactPhone,
        email: cita.contactEmail,
        preferredLocale: localeDeEnum(cita.locale),
      });
      await api.patch(`/api/appointments/${cita.id}`, { patientId: nueva.id });
    });
  }

  const clinica = usuario.role === 'ADMIN' || usuario.role === 'PROFESIONAL';
  const viva = cita && (cita.status === 'PENDIENTE' || cita.status === 'CONFIRMADA');

  return (
    <Modal abierto={Boolean(id)} titulo={t('titulo')} onCerrar={onCerrar} ancho="max-w-2xl">
      {cargando && !cita ? (
        <Cargando />
      ) : error ? (
        <CajaError mensaje={error} onReintentar={recargar} />
      ) : cita ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-2xl font-display text-brand-900">{cita.patient?.fullName ?? cita.contactName}</p>
              <p className="mt-1 font-bold text-accent-700">{cita.service.name}</p>
              <p className="mt-1 text-sm text-muted">
                {fmt.fechaDia(fmt.diaEnClinica(cita.startsAt), 'larga')} · <Ltr>{fmt.hora(cita.startsAt)} – {fmt.hora(cita.endsAt)}</Ltr>
              </p>
            </div>
            <Pastilla tono={TONO_CITA[cita.status]} className="self-start text-sm">
              {tEstado(cita.status)}
            </Pastilla>
          </div>

          <div className="flex flex-wrap gap-2">
            {cita.status === 'PENDIENTE' && (
              <button type="button" disabled={trabajando} onClick={() => cambiarEstado('CONFIRMADA')} className="btn-primary px-4 py-2">
                {t('confirmar')}
              </button>
            )}
            {viva && (
              <button type="button" disabled={trabajando} onClick={() => cambiarEstado('COMPLETADA')} className="btn-outline px-4 py-2">
                {t('atendida')}
              </button>
            )}
            {viva && (
              <button type="button" disabled={trabajando} onClick={() => cambiarEstado('NO_ASISTIO')} className="btn-outline px-4 py-2">
                {t('noAsistio')}
              </button>
            )}
            {viva && (
              <button
                type="button"
                disabled={trabajando}
                onClick={() => {
                  if (!moviendo) {
                    setDia(fmt.diaEnClinica(cita.startsAt));
                    setHora(null);
                  }
                  setMoviendo((v) => !v);
                }}
                className="btn-outline px-4 py-2"
              >
                <CalendarClock className="h-4 w-4" aria-hidden />
                {t('reagendar')}
              </button>
            )}
            {viva && (
              <button type="button" disabled={trabajando} onClick={() => cambiarEstado('CANCELADA')} className="rounded-full px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50">
                {t('cancelar')}
              </button>
            )}
            {!viva && (
              <button type="button" disabled={trabajando} onClick={() => cambiarEstado('CONFIRMADA')} className="btn-outline px-4 py-2">
                {t('reactivar')}
              </button>
            )}
            {trabajando && <Loader2 className="h-5 w-5 animate-spin self-center text-muted" aria-hidden />}
          </div>
          {fallo && <CajaError mensaje={fallo} />}

          {moviendo && (
            <div className="rounded-2xl border border-line p-4">
              <p className="mb-3 text-sm font-bold">{t('nuevoHorario')}</p>
              <SelectorHorario serviceId={cita.service.id} dia={dia} onDia={(d) => { setDia(d); setHora(null); }} elegido={hora} onElegir={setHora} excluirCita={cita.id} />
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setMoviendo(false)} className="btn-outline px-4 py-2">
                  {tc('cancelar')}
                </button>
                <button type="button" disabled={!hora || trabajando} onClick={mover} className="btn-primary px-4 py-2">
                  {t('moverAqui')}
                </button>
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-cream p-4 sm:grid-cols-3">
            <Dato etiqueta={t('telefono')}>
              <Ltr>{fmt.telefono(cita.contactPhone)}</Ltr>
            </Dato>
            <Dato etiqueta={t('correo')}>{cita.contactEmail}</Dato>
            <Dato etiqueta={t('idioma')}>{IDIOMAS[localeDeEnum(cita.locale)].nombre}</Dato>
            <Dato etiqueta={t('origen')}>{tOrigen(cita.source)}</Dato>
            <Dato etiqueta={t('reservada')}>{fmt.fechaHora(cita.createdAt)}</Dato>
            <Dato etiqueta={t('duracion')}>{fmt.duracion(cita.service.durationMin)}</Dato>
            {cita.message && (
              <div className="col-span-full">
                <Dato etiqueta={t('nota')}>
                  <span className="whitespace-pre-line">{cita.message}</span>
                </Dato>
              </div>
            )}
          </dl>

          <div>
            <p className="mb-2 text-sm font-bold">{cita.status === 'PENDIENTE' ? t('pedirConfirmacion') : t('escribirle')}</p>
            {texto && <p className="mb-3 whitespace-pre-line rounded-2xl border border-line p-3 text-sm text-ink/80">{texto}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Contactar telefono={cita.contactPhone} correo={cita.contactEmail} mensaje={texto} />
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(datos.manageUrl).catch(() => undefined);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 1600);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink/80 hover:bg-brand-50"
              >
                {copiado ? <Copy className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
                {copiado ? tc('copiado') : t('copiarEnlace')}
              </button>
            </div>
          </div>

          <div className="border-t border-line pt-5">
            <p className="mb-3 text-sm font-bold">{t('ficha')}</p>
            {cita.patient ? (
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/clientas/${cita.patient.id}`} className="btn-outline px-4 py-2">
                  <UserRound className="h-4 w-4" aria-hidden />
                  {t('verFicha')}
                </Link>
                {clinica && (
                  <Link href={`/admin/mapa-facial/nuevo?cita=${cita.id}`} className="btn-outline px-4 py-2">
                    <ClipboardList className="h-4 w-4" aria-hidden />
                    {t('mapaFacial')}
                  </Link>
                )}
                {clinica && (
                  <Link href={`/admin/mapa-facial/piel/nueva?cita=${cita.id}`} className="btn-outline px-4 py-2">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    {t('fichaPiel')}
                  </Link>
                )}
                <Link href={`/admin/consentimientos?clienta=${cita.patient.id}`} className="btn-outline px-4 py-2">
                  <FileSignature className="h-4 w-4" aria-hidden />
                  {t('consentimiento')}
                </Link>
                <Link href={`/admin/recibos/nuevo?cita=${cita.id}`} className="btn-outline px-4 py-2">
                  <Receipt className="h-4 w-4" aria-hidden />
                  {t('recibo')}
                </Link>
              </div>
            ) : enlazando ? (
              <BuscadorClienta
                elegida={null}
                autoFocus
                onElegir={(c) => c && void hacer(() => api.patch(`/api/appointments/${cita.id}`, { patientId: c.id }))}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted">{t('sinFicha')}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={crearFicha} disabled={trabajando} className="btn-primary px-4 py-2">
                    <UserPlus className="h-4 w-4" aria-hidden />
                    {t('crearFicha')}
                  </button>
                  <button type="button" onClick={() => setEnlazando(true)} className="btn-outline px-4 py-2">
                    {t('enlazarFicha')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
