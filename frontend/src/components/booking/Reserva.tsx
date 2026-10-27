'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CalendarCheck2, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Loader2, Phone } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ApiError, api } from '@/lib/apiClient';
import { sumarDias } from '@/lib/format';
import { useFormato } from '@/lib/useFormato';
import { CATEGORIAS, type AvailabilityResponse, type BookingResponse, type Service } from '@/lib/types';

type Paso = 1 | 2 | 3 | 4;
const DIAS_POR_TANDA = 14;

function Pasos({ paso }: { paso: Paso }) {
  const t = useTranslations('publico.reserva');
  const nombres = [t('paso1'), t('paso2'), t('paso3')];
  return (
    <ol className="mb-8 flex items-center gap-2 text-xs font-bold sm:text-sm">
      {nombres.map((n, i) => {
        const hecho = paso > i + 1;
        const activo = paso === i + 1;
        return (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${hecho ? 'bg-emerald-600 text-white' : activo ? 'bg-brand-700 text-white' : 'bg-line text-muted'}`}>
              {hecho ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span className={`truncate ${activo ? 'text-brand-900' : 'text-muted'}`}>{n}</span>
            {i < 2 && <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function Reserva({ telefono, telefonoEnlace }: { telefono: string; telefonoEnlace: string }) {
  const t = useTranslations('publico.reserva');
  const tCat = useTranslations('estados.categoria');
  const tEstados = useTranslations('estados');
  const fmt = useFormato();
  const params = useSearchParams();
  const [paso, setPaso] = useState<Paso>(1);
  const [servicios, setServicios] = useState<Service[] | null>(null);
  const [servicio, setServicio] = useState<Service | null>(null);
  const [desde, setDesde] = useState(fmt.hoy());
  const [dispo, setDispo] = useState<AvailabilityResponse | null>(null);
  const [dispoDe, setDispoDe] = useState('');
  const [dia, setDia] = useState<string | null>(null);
  const [horario, setHorario] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [correo, setCorreo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [trampa, setTrampa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState<BookingResponse | null>(null);

  useEffect(() => {
    api
      .get<{ items: Service[] }>('/api/public/services')
      .then((d) => {
        setServicios(d.items);
        const pedido = params.get('servicio');
        const s = pedido ? d.items.find((x) => x.slug === pedido) : null;
        if (s) {
          setServicio(s);
          setPaso(2);
        }
      })
      .catch(() => setServicios([]));
  }, [params]);

  const claveDispo = servicio ? `${servicio.id}|${desde}` : '';
  const cargandoDispo = paso === 2 && dispoDe !== claveDispo;
  useEffect(() => {
    if (!servicio || paso !== 2) return;
    api
      .get<AvailabilityResponse>(`/api/public/availability?serviceId=${servicio.id}&from=${desde}&days=${DIAS_POR_TANDA}`)
      .then((d) => {
        setDispo(d);
        setDia((actual) => (actual && d.days.some((x) => x.date === actual && x.availableCount) ? actual : (d.days.find((x) => x.availableCount > 0)?.date ?? null)));
      })
      .catch(() => setDispo(null))
      .finally(() => setDispoDe(`${servicio.id}|${desde}`));
  }, [servicio, desde, paso]);

  const elDia = dispo?.days.find((d) => d.date === dia);
  const libres = elDia?.slots.filter((s) => s.available) ?? [];
  const maximo = sumarDias(fmt.hoy(), dispo?.maxAdvanceDays ?? 60);

  const precio = (s: Service) =>
    s.priceCents === null ? t('consultar') : s.priceCents === 0 ? t('sinCosto') : tEstados('precioMonto', { modo: s.priceMode, precio: fmt.dinero(s.priceCents, true) });

  async function reservar(e: React.FormEvent) {
    e.preventDefault();
    if (!servicio || !horario) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<BookingResponse>('/api/public/bookings', {
        serviceId: servicio.id,
        contactName: nombre,
        contactPhone: tel,
        contactEmail: correo,
        message: mensaje || undefined,
        startsAt: horario.startsAt,
        acceptsPolicy: acepta,
        empresa: trampa,
      });
      setLista(r);
      setPaso(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
      if (err instanceof ApiError && err.status === 409) {
        setHorario(null);
        setPaso(2);
      }
    } finally {
      setEnviando(false);
    }
  }

  const calendario = useMemo(() => {
    if (!lista || !servicio) return null;
    const f = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const q = new URLSearchParams({ action: 'TEMPLATE', text: `${servicio.name} · NGS MedSpa`, dates: `${f(lista.appointment.startsAt)}/${f(lista.appointment.endsAt)}` });
    return `https://calendar.google.com/calendar/render?${q}`;
  }, [lista, servicio]);

  return (
    <div className="shell py-10 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <p className="eyebrow">{t('kicker')}</p>
        <h1 className="mt-4 text-4xl text-brand-900 sm:text-5xl">{t('titulo')}</h1>
        <p className="mt-3 max-w-2xl text-muted">{t('bajada')}</p>

        <div className="mt-8 rounded-[2rem] bg-surface p-5 shadow-soft sm:p-8">
          {paso < 4 && <Pasos paso={paso} />}

          {paso === 1 &&
            (!servicios ? (
              <p className="flex items-center gap-2 py-10 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </p>
            ) : (
              <div className="space-y-6">
                {CATEGORIAS.map((cat) => {
                  const lista = servicios.filter((s) => s.category === cat);
                  if (!lista.length) return null;
                  return (
                    <section key={cat}>
                      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-accent-700 rtl:tracking-normal">{tCat(cat)}</h2>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {lista.map((s) => (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setServicio(s);
                                setHorario(null);
                                setPaso(2);
                              }}
                              className={`flex h-full w-full flex-col rounded-2xl border p-4 text-start transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-soft ${servicio?.id === s.id ? 'border-accent-500 bg-accent-100/40' : 'border-line'}`}
                            >
                              <span className="font-bold text-ink">{s.name}</span>
                              {s.shortDesc && <span className="mt-1 text-sm text-muted">{s.shortDesc}</span>}
                              <span className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
                                <span className="inline-flex items-center gap-1 text-muted">
                                  <Clock className="h-3.5 w-3.5" aria-hidden />
                                  {fmt.duracion(s.durationMin)}
                                </span>
                                <span className="font-bold text-accent-700">{precio(s)}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
                <p className="text-sm text-muted">{t('noSabes')}</p>
              </div>
            ))}

          {paso === 2 && servicio && (
            <div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream p-4">
                <div>
                  <p className="font-bold">{servicio.name}</p>
                  <p className="text-sm text-muted">{fmt.duracion(servicio.durationMin)} · {precio(servicio)}</p>
                </div>
                <button type="button" onClick={() => setPaso(1)} className="text-sm font-bold text-brand-600 hover:underline">
                  {t('cambiar')}
                </button>
              </div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <button type="button" disabled={desde <= fmt.hoy()} onClick={() => setDesde(sumarDias(desde, -DIAS_POR_TANDA))} className="grid h-10 w-10 place-items-center rounded-full border border-line disabled:opacity-30" aria-label={t('anteriores')}>
                  <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                </button>
                <p className="text-sm font-bold first-letter:uppercase text-brand-900">
                  {new Intl.DateTimeFormat(fmt.intl, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${(dia ?? desde).slice(0, 7)}-15T12:00:00Z`))}
                </p>
                <button type="button" disabled={sumarDias(desde, DIAS_POR_TANDA) > maximo} onClick={() => setDesde(sumarDias(desde, DIAS_POR_TANDA))} className="grid h-10 w-10 place-items-center rounded-full border border-line disabled:opacity-30" aria-label={t('siguientes')}>
                  <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                </button>
              </div>
              {cargandoDispo && !dispo ? (
                <p className="flex justify-center py-10 text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                </p>
              ) : (
                <>
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                    {dispo?.days.map((d) => {
                      const fecha = new Date(`${d.date}T12:00:00Z`);
                      const activo = d.date === dia;
                      return (
                        <button
                          key={d.date}
                          type="button"
                          disabled={!d.availableCount}
                          onClick={() => {
                            setDia(d.date);
                            setHorario(null);
                          }}
                          className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border px-2 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                            activo ? 'border-brand-700 bg-brand-700 text-white' : 'border-line hover:border-accent-400'
                          }`}
                        >
                          <span className="text-[0.7rem] font-bold uppercase">{new Intl.DateTimeFormat(fmt.intl, { weekday: 'short', timeZone: 'UTC' }).format(fecha)}</span>
                          <span className="font-display text-2xl leading-tight">{new Intl.DateTimeFormat(fmt.intl, { day: 'numeric', timeZone: 'UTC' }).format(fecha)}</span>
                          <span className={`text-[0.65rem] ${activo ? 'text-white/80' : 'text-muted'}`}>{d.open ? d.availableCount || '—' : t('cerrado')}</span>
                        </button>
                      );
                    })}
                  </div>
                  {dispo && !dispo.days.some((d) => d.availableCount) && <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-muted">{t('sinHorarios')}</p>}
                  {elDia && (
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-bold">{fmt.fechaDia(elDia.date, 'larga')}</p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {libres.map((s) => (
                          <button
                            key={s.startsAt}
                            type="button"
                            onClick={() => setHorario({ startsAt: s.startsAt, endsAt: s.endsAt })}
                            className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition-colors ${horario?.startsAt === s.startsAt ? 'border-accent-500 bg-accent-500 text-white' : 'border-line hover:border-accent-400 hover:bg-accent-100/40'}`}
                          >
                            <bdi dir="ltr">{fmt.hora(s.startsAt)}</bdi>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {error && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="mt-6 flex justify-between gap-2">
                <button type="button" onClick={() => setPaso(1)} className="btn-ghost">
                  <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                  {t('atras')}
                </button>
                <button type="button" disabled={!horario} onClick={() => setPaso(3)} className="btn-grad">
                  {t('continuar')}
                </button>
              </div>
            </div>
          )}

          {paso === 3 && servicio && horario && (
            <form onSubmit={reservar} className="space-y-4">
              <div className="rounded-2xl bg-cream p-4 text-sm">
                <p className="font-bold">{servicio.name}</p>
                <p className="text-muted">
                  {fmt.fechaDia(fmt.diaEnClinica(horario.startsAt), 'larga')} · <bdi dir="ltr">{fmt.hora(horario.startsAt)}</bdi>
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="field-label">{t('nombre')}</span>
                  <input className="field" required autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </label>
                <label className="block">
                  <span className="field-label">{t('telefono')}</span>
                  <input className="field" required type="tel" autoComplete="tel" dir="ltr" placeholder="(214) 555-0100" value={tel} onChange={(e) => setTel(e.target.value)} />
                </label>
                <label className="block">
                  <span className="field-label">
                    {t('correo')} <span className="font-normal text-muted">({t('opcional')})</span>
                  </span>
                  <input className="field" type="email" autoComplete="email" dir="ltr" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="field-label">
                    {t('mensaje')} <span className="font-normal text-muted">({t('opcional')})</span>
                  </span>
                  <textarea className="field min-h-24" value={mensaje} onChange={(e) => setMensaje(e.target.value)} maxLength={600} placeholder={t('mensajeEjemplo')} />
                </label>
                <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute h-px w-px overflow-hidden opacity-0" style={{ clipPath: 'inset(50%)' }} value={trampa} onChange={(e) => setTrampa(e.target.value)} name="empresa" />
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" required checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-700" />
                <span>
                  {t.rich('acepto', {
                    enlace: (c) => (
                      <Link href="/legal/privacidad" target="_blank" className="font-bold text-brand-600 underline">
                        {c}
                      </Link>
                    ),
                  })}
                </span>
              </label>
              {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="flex justify-between gap-2 pt-2">
                <button type="button" onClick={() => setPaso(2)} className="btn-ghost">
                  <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                  {t('atras')}
                </button>
                <button type="submit" disabled={enviando || !acepta} className="btn-grad">
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {t('reservar')}
                </button>
              </div>
            </form>
          )}

          {paso === 4 && lista && servicio && (
            <div className="py-4 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <CalendarCheck2 className="h-8 w-8" aria-hidden />
              </span>
              <h2 className="mt-5 text-3xl text-brand-900">{t('listaTitulo')}</h2>
              <p className="mx-auto mt-3 max-w-md text-muted">{t('listaTexto')}</p>
              <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-cream p-5 text-start">
                <p className="font-bold">{servicio.name}</p>
                <p className="text-sm text-muted">
                  {fmt.fechaDia(fmt.diaEnClinica(lista.appointment.startsAt), 'larga')} · <bdi dir="ltr">{fmt.hora(lista.appointment.startsAt)}</bdi>
                </p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href={`/cita/${lista.manageToken}`} className="btn-primary">
                  {t('verMiCita')}
                </Link>
                {calendario && (
                  <a href={calendario} target="_blank" rel="noopener noreferrer" className="btn-outline">
                    <CalendarPlus className="h-4 w-4" aria-hidden />
                    {t('agregarCalendario')}
                  </a>
                )}
              </div>
              <p className="mt-6 text-xs text-muted">{t('guardaEnlace')}</p>
            </div>
          )}
        </div>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
          <Phone className="h-4 w-4" aria-hidden />
          {t('prefieresLlamar')}{' '}
          <a href={telefonoEnlace} className="font-bold text-brand-700" dir="ltr">
            {telefono}
          </a>
        </p>
      </div>
    </div>
  );
}
