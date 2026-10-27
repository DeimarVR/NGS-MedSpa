'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Archive,
  CalendarPlus,
  ClipboardList,
  FileSignature,
  FileText,
  Images,
  Link2,
  Package,
  Pencil,
  Receipt,
  RotateCcw,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/apiClient';
import { edad } from '@/lib/format';
import { IDIOMAS, aLocale } from '@/lib/idiomas';
import { useFormato } from '@/lib/useFormato';
import type { Hecho, Patient, Retoque, TipoHecho } from '@/lib/types';
import { useUsuario } from '@/components/admin/AuthGuard';
import { ClientaForm } from '@/components/admin/clientas/ClientaForm';
import { NuevaCita } from '@/components/admin/citas/NuevaCita';
import { Contactar } from '@/components/admin/Contactar';
import { confirmar } from '@/components/admin/Dialogo';
import { CajaError, CajaOk, Cargando, Dato, Ltr, Pastilla, Pestanas, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

type Ficha = Patient & { trackingUrl: string; trackingMessage: string };

const ICONO: Record<TipoHecho, typeof CalendarDays> = {
  mapa: ClipboardList,
  'ficha-facial': Sparkles,
  consentimiento: FileSignature,
  fotos: Images,
  producto: Package,
  cita: CalendarDays,
  recibo: Receipt,
};

function Historial({ id }: { id: string }) {
  const t = useTranslations('panel.clientas.ficha');
  const fmt = useFormato();
  const { datos, cargando, error, recargar } = useCarga<{ items: Hecho[] }>(`/api/patients/${id}/historial`);
  if (cargando && !datos) return <Cargando />;
  if (error) return <CajaError mensaje={error} onReintentar={recargar} />;
  if (!datos?.items.length) return <Vacio titulo={t('historialVacio')} />;
  return (
    <ol className="relative space-y-3 border-s-2 border-brand-100 ps-6">
      {datos.items.map((h) => {
        const Icono = ICONO[h.tipo];
        const externo = h.enlace?.startsWith('/api/');
        const cuerpo = (
          <>
            <span className="absolute -start-[2.3rem] top-3 grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-brand-50 text-brand-600">
              <Icono className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-xs font-bold text-muted">{fmt.fechaCorta(h.fecha)}</span>
            <span className="block font-bold">{h.titulo}</span>
            {h.detalle && <span className="block text-sm text-muted">{h.detalle}</span>}
          </>
        );
        return (
          <li key={`${h.tipo}-${h.id}`} className="relative">
            {h.enlace ? (
              externo ? (
                <a href={h.enlace} target="_blank" rel="noopener noreferrer" className="block rounded-2xl bg-surface px-4 py-3 shadow-soft hover:bg-brand-50">
                  {cuerpo}
                </a>
              ) : (
                <Link href={h.enlace} className="block rounded-2xl bg-surface px-4 py-3 shadow-soft hover:bg-brand-50">
                  {cuerpo}
                </Link>
              )
            ) : (
              <div className="rounded-2xl bg-surface px-4 py-3 shadow-soft">{cuerpo}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Recibos({ id }: { id: string }) {
  const t = useTranslations('panel.clientas.ficha');
  const tDoc = useTranslations('estados.documento');
  const tEst = useTranslations('estados.recibo');
  const fmt = useFormato();
  const { datos, cargando } = useCarga<{ items: Array<{ id: string; number: number; series: string; type: 'RECIBO' | 'COTIZACION'; status: string; issueDate: string; total: number; balance: number }> }>(
    `/api/invoices?patientId=${id}&take=50`,
  );
  if (cargando && !datos) return <Cargando />;
  if (!datos?.items.length) return <Vacio titulo={t('recibosVacio')} />;
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {datos.items.map((d) => (
        <li key={d.id}>
          <Link href={`/admin/recibos/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-50">
            <span>
              <span className="font-bold">
                {tDoc(d.type)} {d.series}-{String(d.number).padStart(5, '0')}
              </span>
              <span className="block text-xs text-muted">{fmt.fechaDia(d.issueDate.slice(0, 10))}</span>
            </span>
            <span className="text-end">
              <span className="block font-bold">{fmt.dinero(d.total)}</span>
              <span className="text-xs text-muted">{tEst(d.status as 'EMITIDA')}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function FichaClienta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('panel.clientas.ficha');
  const tGen = useTranslations('estados.genero');
  const tEmb = useTranslations('estados.embarazo');
  const tRef = useTranslations('estados.referido');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const router = useRouter();
  const { usuario } = useUsuario();
  const { datos: ficha, setDatos, cargando, error, recargar } = useCarga<Ficha>(`/api/patients/${id}`);
  const retoques = useCarga<{ items: Retoque[] }>(`/api/retoques?patientId=${id}&todos=true`);
  const [pestana, setPestana] = useState<'historial' | 'recibos'>('historial');
  const [editando, setEditando] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando && !ficha) return <Cargando />;
  if (error || !ficha) return <CajaError mensaje={error ?? ''} onReintentar={recargar} />;

  const clinica = usuario.role === 'ADMIN' || usuario.role === 'PROFESIONAL';
  const anios = edad(ficha.birthDate);
  const alerta = [ficha.allergies && t('alergias'), ficha.pregnancy === 'EMBARAZO' || ficha.pregnancy === 'LACTANCIA' ? tEmb(ficha.pregnancy) : null].filter(Boolean);

  async function archivarOBorrar() {
    if (!ficha) return;
    setFallo(null);
    try {
      const estado = await api.get<{ sePuedeBorrar: boolean; resumen: string }>(`/api/patients/${id}/eliminar`);
      if (estado.sePuedeBorrar) {
        if (!(await confirmar({ titulo: t('borrarTitulo'), mensaje: t('borrarMensaje', { nombre: ficha.fullName }), aceptar: t('borrar'), peligro: true }))) return;
        await api.delete(`/api/patients/${id}/eliminar`);
        router.replace('/admin/clientas');
        return;
      }
      if (!(await confirmar({ titulo: t('archivarTitulo'), mensaje: t('archivarMensaje', { nombre: ficha.fullName, lista: estado.resumen }), aceptar: t('archivar') }))) return;
      const r = await api.post<{ message: string }>(`/api/patients/${id}/eliminar`);
      setAviso(r.message);
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function reactivar() {
    try {
      await api.put(`/api/patients/${id}`, { active: true });
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/clientas" className="mb-4 inline-flex text-sm font-bold text-muted hover:text-brand-700">
        ← {tc('volverA', { destino: t('clientas') })}
      </Link>

      <section className="card overflow-hidden">
        <div className="relative bg-brand-900 px-6 py-7 text-white sm:px-8">
          <div aria-hidden className="pointer-events-none absolute -end-24 -top-24 h-64 w-64 rounded-full opacity-40 blur-3xl" style={{ background: 'radial-gradient(circle,#9C6B53,transparent 65%)' }} />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl text-white sm:text-4xl">{ficha.fullName}</h1>
                {!ficha.active && <Pastilla tono="gris">{t('archivada')}</Pastilla>}
                {ficha.photoConsent && <Pastilla tono="oro">{t('consienteFotos')}</Pastilla>}
              </div>
              <p className="mt-2 text-sm text-on-deep-muted">
                <Ltr>{fmt.telefono(ficha.phone)}</Ltr>
                {ficha.email ? ` · ${ficha.email}` : ''}
                {ficha.instagram ? ` · @${ficha.instagram}` : ''}
                {anios !== null ? ` · ${t('anios', { n: anios })}` : ''}
                {` · ${IDIOMAS[aLocale(ficha.preferredLocale)].nombre}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAgendando(true)} className="btn-grad">
                <CalendarPlus className="h-4 w-4" aria-hidden />
                {t('agendar')}
              </button>
              <button type="button" onClick={() => setEditando(true)} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">
                <Pencil className="h-4 w-4" aria-hidden />
                {tc('editar')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-line px-6 py-4 sm:px-8">
          {clinica && (
            <Link href={`/admin/mapa-facial/nuevo?clienta=${id}`} className="btn-outline px-4 py-2">
              <ClipboardList className="h-4 w-4" aria-hidden />
              {t('mapaFacial')}
            </Link>
          )}
          {clinica && (
            <Link href={`/admin/mapa-facial/piel/nueva?clienta=${id}`} className="btn-outline px-4 py-2">
              <Sparkles className="h-4 w-4" aria-hidden />
              {t('fichaPiel')}
            </Link>
          )}
          <Link href={`/admin/consentimientos?clienta=${id}`} className="btn-outline px-4 py-2">
            <FileSignature className="h-4 w-4" aria-hidden />
            {t('consentimiento')}
          </Link>
          {clinica && (
            <Link href={`/admin/fotos?clienta=${id}`} className="btn-outline px-4 py-2">
              <Images className="h-4 w-4" aria-hidden />
              {t('fotos')}
            </Link>
          )}
          <Link href={`/admin/recibos/nuevo?clienta=${id}`} className="btn-outline px-4 py-2">
            <FileText className="h-4 w-4" aria-hidden />
            {t('recibo')}
          </Link>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            {alerta.length > 0 && (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-bold">{t('atencion')}</p>
                  {ficha.allergies && <p className="mt-1">{ficha.allergies}</p>}
                  {(ficha.pregnancy === 'EMBARAZO' || ficha.pregnancy === 'LACTANCIA') && <p className="mt-1">{tEmb(ficha.pregnancy)}</p>}
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-4">
              <Dato etiqueta={t('nacimiento')}>{ficha.birthDate ? fmt.fechaDia(ficha.birthDate.slice(0, 10), 'larga') : null}</Dato>
              <Dato etiqueta={t('genero')}>{tGen(ficha.gender)}</Dato>
              <Dato etiqueta={t('ciudad')}>{[ficha.city, ficha.address].filter(Boolean).join(' · ')}</Dato>
              <Dato etiqueta={t('comoNosConocio')}>{ficha.referralSource ? `${tRef(ficha.referralSource)}${ficha.referralNote ? ` · ${ficha.referralNote}` : ''}` : null}</Dato>
              <Dato etiqueta={t('medicamentos')}>{ficha.medications}</Dato>
              <Dato etiqueta={t('embarazo')}>{tEmb(ficha.pregnancy)}</Dato>
              <div className="col-span-2">
                <Dato etiqueta={t('antecedentes')}>
                  <span className="whitespace-pre-line">{ficha.medicalNotes}</span>
                </Dato>
              </div>
            </dl>

            <div className="rounded-2xl bg-cream p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Link2 className="h-4 w-4 text-accent-500" aria-hidden />
                {t('seguimiento')}
              </p>
              <p className="mt-1 text-xs text-muted">{t('seguimientoTexto')}</p>
              <div className="mt-3">
                <Contactar telefono={ficha.phone} correo={ficha.email} mensaje={ficha.trackingMessage} />
              </div>
            </div>

            {retoques.datos && retoques.datos.items.length > 0 && (
              <div className="rounded-2xl border border-line p-4">
                <p className="flex items-center gap-2 text-sm font-bold">
                  <RotateCcw className="h-4 w-4 text-accent-500" aria-hidden />
                  {t('retoques')}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {retoques.datos.items.map((r) => (
                    <li key={r.clave} className="flex justify-between gap-2">
                      <span>{r.serviceName}</span>
                      <span className={r.diasDeRetraso > 0 ? 'font-bold text-amber-700' : 'text-muted'}>{fmt.fechaCorta(r.tocaEl)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {usuario.role === 'ADMIN' && (
              <div className="border-t border-line pt-4">
                {ficha.active ? (
                  <button type="button" onClick={archivarOBorrar} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-red-600">
                    <Archive className="h-4 w-4" aria-hidden />
                    {t('archivarOBorrar')}
                  </button>
                ) : (
                  <button type="button" onClick={reactivar} className="inline-flex items-center gap-2 text-sm font-bold text-brand-600 hover:underline">
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    {t('reactivar')}
                  </button>
                )}
              </div>
            )}
            {aviso && <CajaOk mensaje={aviso} />}
            {fallo && <CajaError mensaje={fallo} />}
          </div>

          <div>
            <div className="mb-4">
              <Pestanas
                etiqueta={t('secciones')}
                valor={pestana}
                onChange={setPestana}
                opciones={[
                  { valor: 'historial', texto: t('historial') },
                  { valor: 'recibos', texto: t('recibos') },
                ]}
              />
            </div>
            {pestana === 'historial' ? <Historial id={id} /> : <Recibos id={id} />}
          </div>
        </div>
      </section>

      <ClientaForm
        abierto={editando}
        clienta={ficha}
        onCerrar={() => setEditando(false)}
        onGuardada={(p) => {
          setEditando(false);
          setDatos({ ...ficha, ...p, preferredLocale: aLocale(p.preferredLocale) });
          recargar();
        }}
      />
      <NuevaCita
        abierto={agendando}
        inicial={{ clienta: { id: ficha.id, fullName: ficha.fullName, phone: ficha.phone, email: ficha.email, preferredLocale: ficha.preferredLocale, birthDate: ficha.birthDate } }}
        onCerrar={() => setAgendando(false)}
        onCreada={() => undefined}
      />
    </div>
  );
}
