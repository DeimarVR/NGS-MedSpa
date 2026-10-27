'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BellRing, CalendarCheck2, CalendarDays, CalendarPlus, Clock3, Receipt, RotateCcw, Sparkles, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { useFormato } from '@/lib/useFormato';
import type { AppointmentStatus, Retoque } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { Contactar } from '@/components/admin/Contactar';
import { CajaError, Cargando, Pastilla, TONO_CITA, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

interface CitaCorta {
  id: string;
  contactName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  service: { name: string };
  patient: { id: string; fullName: string } | null;
}
interface Resumen {
  today: number;
  week: number;
  pending: number;
  upcoming: CitaCorta[];
  hoy: CitaCorta[];
}
interface Recordatorio {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  startsAt: string;
  status: AppointmentStatus;
  reminderSentAt: string | null;
  service: { name: string };
}

function Indicador({ icono, valor, texto, href, tono }: { icono: React.ReactNode; valor: number | string; texto: string; href: string; tono: string }) {
  return (
    <Link href={href} className="card group flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5">
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tono}`}>{icono}</span>
      <span className="min-w-0">
        <span className="block font-display text-3xl leading-none text-brand-900">{valor}</span>
        <span className="mt-1 block text-sm text-muted">{texto}</span>
      </span>
    </Link>
  );
}

function Recordatorios() {
  const t = useTranslations('panel.tablero');
  const fmt = useFormato();
  const { datos, cargando, error, recargar } = useCarga<{ items: Recordatorio[]; pendientes: number; fecha: string }>('/api/appointments/recordatorios');
  const [textos, setTextos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!datos) return;
    for (const cita of datos.items) {
      api
        .get<{ texto: string }>(`/api/appointments/${cita.id}/recordatorio?tipo=recordatorio`)
        .then((r) => setTextos((antes) => ({ ...antes, [cita.id]: r.texto })))
        .catch(() => undefined);
    }
  }, [datos]);

  async function marcar(id: string, enviado: boolean) {
    await api.patch(`/api/appointments/${id}/recordatorio`, { enviado }).catch(() => undefined);
    recargar();
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="titulo-manana">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-manana" className="flex items-center gap-2 text-lg">
            <BellRing className="h-5 w-5 text-accent-500" aria-hidden />
            {t('manana')}
          </h2>
          <p className="mt-1 text-sm text-muted">{datos ? fmt.fechaDia(datos.fecha, 'larga') : t('mananaTexto')}</p>
        </div>
        {datos && datos.pendientes > 0 && <Pastilla tono="ambar">{t('porAvisar', { n: datos.pendientes })}</Pastilla>}
      </div>
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <CajaError mensaje={error} onReintentar={recargar} />
      ) : !datos?.items.length ? (
        <p className="rounded-2xl bg-cream px-4 py-6 text-center text-sm text-muted">{t('mananaVacio')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {datos.items.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 py-3">
              <div className="min-w-0">
                <p className="font-bold">
                  <span className="me-2 text-brand-600">{fmt.hora(c.startsAt)}</span>
                  {c.contactName}
                </p>
                <p className="text-sm text-muted">
                  {c.service.name}
                  {c.reminderSentAt && <span className="ms-2 text-emerald-700">· {t('avisada')}</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Contactar compacto telefono={c.contactPhone} correo={c.contactEmail} mensaje={textos[c.id]} onUsado={() => !c.reminderSentAt && void marcar(c.id, true)} />
                <button
                  type="button"
                  onClick={() => marcar(c.id, !c.reminderSentAt)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${c.reminderSentAt ? 'bg-emerald-50 text-emerald-700' : 'border border-line text-muted hover:bg-brand-50'}`}
                >
                  {c.reminderSentAt ? t('avisadaQuitar') : t('marcarAvisada')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Retoques() {
  const t = useTranslations('panel.tablero');
  const fmt = useFormato();
  const { datos, cargando, error, recargar } = useCarga<{ items: Retoque[] }>('/api/retoques');
  const [fallo, setFallo] = useState<string | null>(null);

  async function marcar(r: Retoque, status: 'CONTACTADA' | 'DESCARTADA') {
    setFallo(null);
    try {
      await api.post('/api/retoques', { patientId: r.patientId, serviceId: r.serviceId, baseDate: r.baseDate, status });
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  return (
    <section id="retoques" className="card scroll-mt-24 p-5 sm:p-6" aria-labelledby="titulo-retoques">
      <div className="mb-4">
        <h2 id="titulo-retoques" className="flex items-center gap-2 text-lg">
          <RotateCcw className="h-5 w-5 text-accent-500" aria-hidden />
          {t('retoques')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('retoquesTexto')}</p>
      </div>
      {fallo && <CajaError mensaje={fallo} />}
      {cargando && !datos ? (
        <Cargando />
      ) : error ? (
        <CajaError mensaje={error} onReintentar={recargar} />
      ) : !datos?.items.length ? (
        <p className="rounded-2xl bg-cream px-4 py-6 text-center text-sm text-muted">{t('retoquesVacio')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {datos.items.map((r) => (
            <li key={r.clave} className="flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <Link href={`/admin/clientas/${r.patientId}`} className="font-bold hover:text-brand-600">
                  {r.patientName}
                </Link>
                <p className="text-sm text-muted">
                  {r.serviceName} · {t('ultimaVez', { fecha: fmt.fechaCorta(r.ultimaVez) })} ·{' '}
                  <span className={r.diasDeRetraso > 0 ? 'font-bold text-amber-700' : ''}>
                    {r.diasDeRetraso > 0 ? t('atrasado', { n: r.diasDeRetraso }) : t('tocaEl', { fecha: fmt.fechaCorta(r.tocaEl) })}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Contactar compacto telefono={r.phone} correo={r.email} mensaje={r.mensaje} />
                <button type="button" onClick={() => marcar(r, 'CONTACTADA')} className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-900">
                  {t('contactada')}
                </button>
                <button type="button" onClick={() => marcar(r, 'DESCARTADA')} className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted hover:bg-brand-50">
                  {t('descartar')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Tablero() {
  const t = useTranslations('panel.tablero');
  const tEstado = useTranslations('estados.cita');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const { datos, cargando, error, recargar } = useCarga<Resumen>('/api/appointments/summary');
  const retoques = useCarga<{ items: Retoque[] }>('/api/retoques');
  // El tablero solo se dibuja en el navegador (detrás de la sesión): la hora es la de quien mira.
  const [hora] = useState(() => new Date().getHours());
  const saludo = hora < 12 ? 'manana' : hora < 19 ? 'tarde' : 'noche';

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{fmt.fechaDia(fmt.hoy(), 'larga')}</p>
          <h1 className="mt-3 text-3xl text-brand-900 sm:text-4xl">{t(`saludo.${saludo}`, { nombre: primerNombre(usuario.fullName) })}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/citas?nueva=1" className="btn-grad">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            {t('nuevaCita')}
          </Link>
          <Link href="/admin/clientas?nueva=1" className="btn-outline">
            <UserPlus className="h-4 w-4" aria-hidden />
            {t('nuevaClienta')}
          </Link>
          <Link href="/admin/recibos/nuevo" className="btn-outline">
            <Receipt className="h-4 w-4" aria-hidden />
            {t('nuevoRecibo')}
          </Link>
        </div>
      </header>

      {error && <CajaError mensaje={error} onReintentar={recargar} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador icono={<CalendarCheck2 className="h-5 w-5" aria-hidden />} valor={datos?.today ?? '—'} texto={t('kpiHoy')} href="/admin/citas" tono="bg-brand-100 text-brand-700" />
        <Indicador icono={<CalendarDays className="h-5 w-5" aria-hidden />} valor={datos?.week ?? '—'} texto={t('kpiSemana')} href="/admin/citas?vista=semana" tono="bg-accent-100 text-accent-700" />
        <Indicador icono={<Clock3 className="h-5 w-5" aria-hidden />} valor={datos?.pending ?? '—'} texto={t('kpiPendientes')} href="/admin/citas?estado=PENDIENTE" tono="bg-amber-50 text-amber-700" />
        <Indicador icono={<Sparkles className="h-5 w-5" aria-hidden />} valor={retoques.datos?.items.length ?? '—'} texto={t('kpiRetoques')} href="/admin#retoques" tono="bg-leaf-100 text-leaf-700" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="titulo-hoy">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="titulo-hoy" className="text-lg">
              {t('agendaHoy')}
            </h2>
            <Link href="/admin/citas" className="text-sm font-bold text-brand-600 hover:underline">
              {t('verAgenda')}
            </Link>
          </div>
          {cargando && !datos ? (
            <Cargando />
          ) : !datos?.hoy.length ? (
            <Vacio icono={<CalendarDays className="h-5 w-5" aria-hidden />} titulo={t('hoyVacio')} texto={t('hoyVacioTexto')} />
          ) : (
            <ol className="relative space-y-3 border-s-2 border-brand-100 ps-5">
              {datos.hoy.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute -start-[1.72rem] top-3 h-3 w-3 rounded-full border-2 border-surface bg-accent-500" aria-hidden />
                  <Link href={`/admin/citas?cita=${c.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-4 py-3 transition-colors hover:bg-brand-50">
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-brand-600">
                        {fmt.hora(c.startsAt)} – {fmt.hora(c.endsAt)}
                      </span>
                      <span className="block truncate font-bold">{c.patient?.fullName ?? c.contactName}</span>
                      <span className="block truncate text-sm text-muted">{c.service.name}</span>
                    </span>
                    <Pastilla tono={TONO_CITA[c.status]}>{tEstado(c.status)}</Pastilla>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
        <Recordatorios />
      </div>

      <div className="mt-6">
        <Retoques />
      </div>
    </div>
  );
}

/** «Dra. Ana Pérez» → «Ana»: el saludo usa el nombre, no el título. */
function primerNombre(completo: string): string {
  const partes = completo.trim().split(/\s+/);
  const titulo = /^(dra?|lic|sra?|srta|mr|mrs|ms|mme|mlle|m)\.?$/i;
  return (partes.length > 1 && titulo.test(partes[0]) ? partes[1] : partes[0]) ?? '';
}
