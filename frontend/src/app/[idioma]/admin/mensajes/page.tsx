'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Inbox, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { IDIOMAS, aLocale } from '@/lib/idiomas';
import { useFormato } from '@/lib/useFormato';
import { useUsuario } from '@/components/admin/AuthGuard';
import { Contactar } from '@/components/admin/Contactar';
import { confirmar } from '@/components/admin/Dialogo';
import { CajaError, Cargando, Encabezado, Ltr, Pastilla, Pestanas, Vacio } from '@/components/admin/ui';
import { mensajeDe, useCarga } from '@/components/admin/useCarga';

interface Mensaje {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  locale: string;
  handled: boolean;
  createdAt: string;
}

export default function Mensajes() {
  const t = useTranslations('panel.mensajes');
  const tc = useTranslations('comun');
  const fmt = useFormato();
  const { usuario } = useUsuario();
  const [filtro, setFiltro] = useState<'pendientes' | 'atendidos' | 'todos'>('pendientes');
  const [fallo, setFallo] = useState<string | null>(null);
  const { datos, cargando, error, recargar } = useCarga<{ items: Mensaje[]; sinAtender: number }>(
    `/api/contact-messages${filtro === 'todos' ? '' : `?handled=${filtro === 'atendidos'}`}`,
  );

  async function marcar(m: Mensaje, handled: boolean) {
    try {
      await api.patch(`/api/contact-messages/${m.id}`, { handled });
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  async function borrar(m: Mensaje) {
    if (!(await confirmar({ titulo: t('borrarTitulo'), mensaje: t('borrarMensaje', { nombre: m.name }), aceptar: tc('eliminar'), peligro: true }))) return;
    try {
      await api.delete(`/api/contact-messages/${m.id}`);
      recargar();
    } catch (e) {
      setFallo(mensajeDe(e));
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Encabezado titulo={t('titulo')} bajada={t('bajada')} />
      <div className="mb-4">
        <Pestanas
          etiqueta={t('filtro')}
          valor={filtro}
          onChange={setFiltro}
          opciones={[
            { valor: 'pendientes', texto: t('pendientes'), cuenta: datos?.sinAtender },
            { valor: 'atendidos', texto: t('atendidos') },
            { valor: 'todos', texto: tc('todos') },
          ]}
        />
      </div>
      {(error || fallo) && <CajaError mensaje={error ?? fallo ?? ''} onReintentar={recargar} />}
      {cargando && !datos ? (
        <Cargando />
      ) : !datos?.items.length ? (
        <Vacio icono={<Inbox className="h-5 w-5" aria-hidden />} titulo={filtro === 'pendientes' ? t('alDia') : t('vacio')} />
      ) : (
        <ul className="space-y-3">
          {datos.items.map((m) => (
            <li key={m.id} className={`card p-5 ${m.handled ? 'opacity-75' : ''}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold">
                    {m.name}
                    {!m.handled && <Pastilla tono="ambar" className="ms-2">{t('nuevo')}</Pastilla>}
                  </p>
                  <p className="text-sm text-muted">
                    <Ltr>{fmt.telefono(m.phone)}</Ltr>
                    {m.email ? ` · ${m.email}` : ''} · {IDIOMAS[aLocale(m.locale)].nombre}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted">{fmt.fechaHora(m.createdAt)}</p>
              </div>
              {m.subject && <p className="mt-3 text-sm font-bold">{m.subject}</p>}
              <p className="mt-2 whitespace-pre-line rounded-2xl bg-cream p-4 text-sm" dir="auto">
                {m.message}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Contactar compacto telefono={m.phone} correo={m.email} />
                <div className="flex gap-2">
                  {m.handled ? (
                    <button type="button" onClick={() => marcar(m, false)} className="btn-outline px-4 py-2">
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      {t('reabrir')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => marcar(m, true)} className="btn-primary px-4 py-2">
                      <Check className="h-4 w-4" aria-hidden />
                      {t('atendido')}
                    </button>
                  )}
                  {usuario.role === 'ADMIN' && (
                    <button type="button" onClick={() => borrar(m)} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label={tc('eliminar')}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
