'use client';

import { Suspense, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ban, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Rows3 } from 'lucide-react';
import { diaDeLaSemana, sumarDias } from '@/lib/format';
import { useFormato } from '@/lib/useFormato';
import { ESTADOS_CITA, type AppointmentListItem, type AppointmentStatus } from '@/lib/types';
import { Bloqueos } from '@/components/admin/citas/Bloqueos';
import { DetalleCita } from '@/components/admin/citas/DetalleCita';
import { NuevaCita, type InicialCita } from '@/components/admin/citas/NuevaCita';
import { CajaError, Cargando, CampoBusqueda, Encabezado, Ltr, Pastilla, Pestanas, TONO_CITA, Vacio } from '@/components/admin/ui';
import { useCarga } from '@/components/admin/useCarga';
import { useParametros } from '@/components/admin/useParametros';

type Vista = 'dia' | 'semana' | 'lista';
interface Lista {
  items: AppointmentListItem[];
  total: number;
}
interface Bloqueo {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}
interface DiaHorario {
  dayOfWeek: number;
  active: boolean;
  openTime: string;
  closeTime: string;
}

const HORA_PX = 64;
const aMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const COLOR_CITA: Record<AppointmentStatus, string> = {
  PENDIENTE: 'border-amber-300 bg-amber-50 text-amber-950',
  CONFIRMADA: 'border-brand-300 bg-brand-50 text-brand-900',
  COMPLETADA: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  NO_ASISTIO: 'border-red-200 bg-red-50 text-red-900 opacity-75',
  CANCELADA: 'border-slate-200 bg-slate-50 text-slate-500 line-through opacity-60',
};

/**
 * Reparte en carriles las citas que se pisan (cuando hay más de un cupo). El
 * ancho se calcula por grupo de citas encadenadas, no por día: una cita sola
 * por la tarde ocupa todo el ancho aunque por la mañana hubiera dos a la vez.
 */
function enCarriles(citas: AppointmentListItem[], fmt: ReturnType<typeof useFormato>) {
  const ordenadas = [...citas].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const bloques: Array<{ cita: AppointmentListItem; ini: number; fin: number; carril: number; carriles: number }> = [];
  let grupo: typeof bloques = [];
  let finDeCarril: number[] = [];
  let finDelGrupo = -1;
  const cerrar = () => {
    for (const b of grupo) b.carriles = Math.max(1, finDeCarril.length);
    grupo = [];
    finDeCarril = [];
  };
  for (const c of ordenadas) {
    const ini = aMin(fmt.horaEnClinica(c.startsAt));
    const fin = Math.max(ini + 15, aMin(fmt.horaEnClinica(c.endsAt)) || 24 * 60);
    if (ini >= finDelGrupo) cerrar();
    let carril = finDeCarril.findIndex((f) => f <= ini);
    if (carril === -1) carril = finDeCarril.push(fin) - 1;
    else finDeCarril[carril] = fin;
    finDelGrupo = Math.max(finDelGrupo, fin);
    const bloque = { cita: c, ini, fin, carril, carriles: 1 };
    grupo.push(bloque);
    bloques.push(bloque);
  }
  cerrar();
  return bloques;
}

function Calendario({
  dias,
  citas,
  bloqueos,
  horario,
  onCita,
  onHueco,
}: {
  dias: string[];
  citas: AppointmentListItem[];
  bloqueos: Bloqueo[];
  horario: DiaHorario[];
  onCita: (id: string) => void;
  onHueco: (dia: string, hora: string) => void;
}) {
  const t = useTranslations('panel.citas');
  const fmt = useFormato();
  const abiertos = horario.filter((h) => h.active);
  const desde = Math.min(...(abiertos.length ? abiertos.map((h) => aMin(h.openTime)) : [9 * 60])) - 60;
  const hasta = Math.max(...(abiertos.length ? abiertos.map((h) => aMin(h.closeTime)) : [19 * 60])) + 60;
  const inicio = Math.max(0, Math.floor(desde / 60) * 60);
  const fin = Math.min(24 * 60, Math.ceil(hasta / 60) * 60);
  const horas = Array.from({ length: (fin - inicio) / 60 }, (_, i) => inicio + i * 60);
  const alto = ((fin - inicio) / 60) * HORA_PX;
  const hoy = fmt.hoy();
  const y = (min: number) => ((min - inicio) / 60) * HORA_PX;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: dias.length > 1 ? 860 : undefined }}>
          <div className="grid border-b border-line" style={{ gridTemplateColumns: `4rem repeat(${dias.length}, minmax(0, 1fr))` }}>
            <div />
            {dias.map((d) => {
              const h = horario.find((x) => x.dayOfWeek === diaDeLaSemana(d));
              return (
                <div key={d} className={`border-s border-line px-3 py-3 text-center ${d === hoy ? 'bg-accent-100/60' : ''}`}>
                  <p className="text-xs font-bold uppercase text-muted rtl:tracking-normal">
                    {new Intl.DateTimeFormat(fmt.intl, { weekday: dias.length > 1 ? 'short' : 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))}
                  </p>
                  <p className={`font-display text-2xl leading-tight ${d === hoy ? 'text-accent-700' : 'text-brand-900'}`}>
                    {new Intl.DateTimeFormat(fmt.intl, { day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))}
                  </p>
                  {!h?.active && <p className="text-[0.7rem] text-muted">{t('cerrado')}</p>}
                </div>
              );
            })}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `4rem repeat(${dias.length}, minmax(0, 1fr))` }}>
            <div className="relative" style={{ height: alto }}>
              {horas.map((m) => (
                <span key={m} className="absolute end-2 -translate-y-2 text-[0.7rem] text-muted" style={{ top: y(m) }}>
                  <Ltr>{new Intl.DateTimeFormat(fmt.intl, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, Math.floor(m / 60))))}</Ltr>
                </span>
              ))}
            </div>
            {dias.map((d) => {
              const h = horario.find((x) => x.dayOfWeek === diaDeLaSemana(d));
              const delDia = citas.filter((c) => fmt.diaEnClinica(c.startsAt) === d);
              const bloques = enCarriles(delDia, fmt);
              const bloqueosDelDia = bloqueos.filter((b) => fmt.diaEnClinica(b.startsAt) <= d && fmt.diaEnClinica(b.endsAt) >= d);
              return (
                <div
                  key={d}
                  className={`relative border-s border-line ${h?.active ? '' : 'bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,rgba(15,26,46,0.035)_8px,rgba(15,26,46,0.035)_16px)]'}`}
                  style={{ height: alto }}
                >
                  {horas.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onHueco(d, `${String(Math.floor(m / 60)).padStart(2, '0')}:00`)}
                      className="absolute inset-x-0 border-t border-line/70 hover:bg-brand-50/60"
                      style={{ top: y(m), height: HORA_PX }}
                      aria-label={t('crearAqui')}
                    />
                  ))}
                  {h?.active && (
                    <>
                      <div className="pointer-events-none absolute inset-x-0 bg-ink/[0.03]" style={{ top: 0, height: Math.max(0, y(aMin(h.openTime))) }} />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/[0.03]" style={{ top: y(aMin(h.closeTime)) }} />
                    </>
                  )}
                  {bloqueosDelDia.map((b) => {
                    const a = fmt.diaEnClinica(b.startsAt) < d ? inicio : aMin(fmt.horaEnClinica(b.startsAt));
                    const z = fmt.diaEnClinica(b.endsAt) > d ? fin : aMin(fmt.horaEnClinica(b.endsAt));
                    return (
                      <div
                        key={b.id}
                        className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-100/80 px-2 py-1 text-[0.7rem] font-bold text-slate-500"
                        style={{ top: y(Math.max(a, inicio)), height: Math.max(18, y(Math.min(z, fin)) - y(Math.max(a, inicio))) }}
                      >
                        {b.reason || t('bloqueado')}
                      </div>
                    );
                  })}
                  {bloques.map(({ cita, ini, fin: f, carril, carriles }) => (
                    <button
                      key={cita.id}
                      type="button"
                      onClick={() => onCita(cita.id)}
                      className={`absolute overflow-hidden rounded-xl border px-2 py-1 text-start text-xs shadow-sm transition-transform hover:z-10 hover:-translate-y-px hover:shadow-soft ${COLOR_CITA[cita.status]}`}
                      style={{
                        top: y(ini) + 1,
                        height: Math.max(22, y(f) - y(ini) - 2),
                        insetInlineStart: `calc(${(carril / carriles) * 100}% + 3px)`,
                        width: `calc(${100 / carriles}% - 6px)`,
                      }}
                    >
                      <span className="block truncate font-bold">{cita.patient?.fullName ?? cita.contactName}</span>
                      <span className="block truncate opacity-80">
                        <Ltr>{fmt.hora(cita.startsAt)}</Ltr> · {cita.service.name}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListaDeCitas({ onCita }: { onCita: (id: string) => void }) {
  const t = useTranslations('panel.citas');
  const tEstado = useTranslations('estados.cita');
  const tOrigen = useTranslations('estados.origen');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { leer, poner } = useParametros();
  const periodo = (leer('periodo') as 'proximas' | 'pasadas' | 'todas') ?? 'proximas';
  const estado = leer('estado') ?? '';
  const [q, setQ] = useState(leer('q') ?? '');
  const [cuantas, setCuantas] = useState(50);
  const ruta = `/api/appointments?periodo=${periodo}&take=${cuantas}${estado ? `&status=${estado}` : ''}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`;
  const { datos, cargando, error, recargar } = useCarga<Lista>(ruta);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Pestanas
          etiqueta={t('periodo')}
          valor={periodo}
          onChange={(v) => poner({ periodo: v === 'proximas' ? null : v })}
          opciones={[
            { valor: 'proximas', texto: t('proximas') },
            { valor: 'pasadas', texto: t('pasadas') },
            { valor: 'todas', texto: t('todas') },
          ]}
        />
        <select value={estado} onChange={(e) => poner({ estado: e.target.value || null })} className="field w-auto py-2" aria-label={t('estado')}>
          <option value="">{t('todosLosEstados')}</option>
          {ESTADOS_CITA.map((s) => (
            <option key={s} value={s}>
              {tEstado(s)}
            </option>
          ))}
        </select>
        <CampoBusqueda valor={q} onChange={setQ} placeholder={t('buscar')} className="lg:ms-auto lg:w-72" />
      </div>
      {error && <CajaError mensaje={error} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<CalendarDays className="h-5 w-5" aria-hidden />} titulo={t('vacio')} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-cream text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t('cuando')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('clienta')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('tratamiento')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('origen')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('estado')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {datos.items.map((c) => (
                  <tr key={c.id} onClick={() => onCita(c.id)} className="cursor-pointer hover:bg-brand-50/60">
                    <td className="px-4 py-3">
                      <p className="font-bold">{fmt.fechaDia(fmt.diaEnClinica(c.startsAt))}</p>
                      <p className="text-muted">
                        <Ltr>{fmt.hora(c.startsAt)}</Ltr>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold">{c.patient?.fullName ?? c.contactName}</p>
                      <p className="text-muted">
                        <Ltr>{fmt.telefono(c.contactPhone)}</Ltr>
                      </p>
                    </td>
                    <td className="px-4 py-3">{c.service.name}</td>
                    <td className="px-4 py-3 text-muted">{tOrigen(c.source)}</td>
                    <td className="px-4 py-3">
                      <Pastilla tono={TONO_CITA[c.status]}>{tEstado(c.status)}</Pastilla>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.total > datos.items.length && (
            <div className="border-t border-line p-3 text-center">
              <button type="button" onClick={() => setCuantas((n) => n + 50)} className="btn-ghost">
                {tc('cargarMas')} ({datos.items.length}/{datos.total})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaginaCitas() {
  const t = useTranslations('panel.citas');
  const tEstado = useTranslations('estados.cita');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { leer, poner } = useParametros();
  const vista = (leer('vista') as Vista) || (leer('estado') || leer('periodo') ? 'lista' : 'semana');
  const dia = leer('dia') ?? fmt.hoy();
  const citaAbierta = leer('cita');
  const [nueva, setNueva] = useState<InicialCita | null>(leer('nueva') ? {} : null);
  const [bloqueos, setBloqueos] = useState(false);

  const dias = useMemo(() => {
    if (vista === 'dia') return [dia];
    const inicio = sumarDias(dia, -diaDeLaSemana(dia));
    return Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i));
  }, [vista, dia]);

  const enCalendario = vista !== 'lista';
  const citas = useCarga<Lista>(enCalendario ? `/api/appointments?desdeDia=${dias[0]}&dias=${dias.length}&take=500` : null);
  const listaBloqueos = useCarga<{ items: Bloqueo[] }>(
    enCalendario ? `/api/blackouts?desde=${new Date(`${dias[0]}T00:00:00Z`).toISOString()}&hasta=${new Date(`${sumarDias(dias[dias.length - 1], 2)}T00:00:00Z`).toISOString()}` : null,
  );
  const horario = useCarga<{ items: DiaHorario[] }>('/api/horario');

  function recargar() {
    citas.recargar();
    listaBloqueos.recargar();
  }

  const paso = vista === 'dia' ? 1 : 7;
  const titulo =
    vista === 'dia'
      ? fmt.fechaDia(dia, 'larga')
      : `${fmt.fechaDia(dias[0])} – ${fmt.fechaDia(dias[6])}`;

  return (
    <div className="mx-auto max-w-7xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')}>
        <button type="button" onClick={() => setBloqueos(true)} className="btn-outline">
          <Ban className="h-4 w-4" aria-hidden />
          {t('bloquear')}
        </button>
        <button type="button" onClick={() => setNueva({ dia: vista === 'lista' ? undefined : dia })} className="btn-grad">
          <CalendarPlus className="h-4 w-4" aria-hidden />
          {t('nueva')}
        </button>
      </Encabezado>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Pestanas
          etiqueta={t('vista')}
          valor={vista}
          onChange={(v) => poner({ vista: v, estado: v === 'lista' ? leer('estado') : null, periodo: v === 'lista' ? leer('periodo') : null })}
          opciones={[
            { valor: 'dia', texto: t('vistaDia') },
            { valor: 'semana', texto: t('vistaSemana') },
            { valor: 'lista', texto: t('vistaLista') },
          ]}
        />
        {enCalendario && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => poner({ dia: sumarDias(dia, -paso) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-50" aria-label={tc('anterior')}>
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </button>
            <button type="button" onClick={() => poner({ dia: null })} className="btn-outline px-4 py-2">
              {tc('hoy')}
            </button>
            <button type="button" onClick={() => poner({ dia: sumarDias(dia, paso) })} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-50" aria-label={tc('siguiente')}>
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </button>
            <p className="ms-2 hidden font-bold text-brand-900 md:block">{titulo}</p>
          </div>
        )}
      </div>

      {enCalendario ? (
        <>
          <p className="mb-3 font-bold text-brand-900 md:hidden">{titulo}</p>
          {citas.error && <CajaError mensaje={citas.error} onReintentar={recargar} />}
          {citas.cargando && !citas.datos ? (
            <Cargando />
          ) : (
            <Calendario
              dias={dias}
              citas={citas.datos?.items ?? []}
              bloqueos={listaBloqueos.datos?.items ?? []}
              horario={horario.datos?.items ?? []}
              onCita={(id) => poner({ cita: id })}
              onHueco={(d, h) => setNueva({ dia: d, hora: h })}
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            {(['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'NO_ASISTIO'] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded border ${COLOR_CITA[s]}`} aria-hidden />
                {tEstado(s)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <Rows3 className="h-3.5 w-3.5" aria-hidden />
              {t('ayudaHueco')}
            </span>
          </div>
        </>
      ) : (
        <ListaDeCitas onCita={(id) => poner({ cita: id })} />
      )}

      <NuevaCita abierto={nueva !== null} inicial={nueva ?? undefined} onCerrar={() => { setNueva(null); poner({ nueva: null }); }} onCreada={recargar} />
      <DetalleCita key={citaAbierta ?? 'ninguna'} id={citaAbierta} onCerrar={() => poner({ cita: null })} onCambio={recargar} />
      <Bloqueos abierto={bloqueos} onCerrar={() => setBloqueos(false)} onCambio={recargar} />
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense>
      <PaginaCitas />
    </Suspense>
  );
}
