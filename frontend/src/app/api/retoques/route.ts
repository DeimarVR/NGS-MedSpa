import { z } from 'zod';
import { TouchUpStatus } from '@/generated/prisma/client';
import { enumDeLocale } from '@/lib/idiomas';
import { idiomaDe } from '@/server/i18n';
import { calcularRetoques, marcarRetoque } from '@/server/modules/retoques/retoques.service';
import { textoParaClienta } from '@/server/modules/mensajes/textos';
import { body, booleanoDeConsulta, query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Retoques que tocan (último tratamiento + días del tratamiento), con el
 * mensaje ya escrito en el idioma de cada clienta para mandarlo a mano.
 */
export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(
    req,
    z.object({
      patientId: z.string().optional(),
      margenDias: z.coerce.number().int().min(0).max(120).optional(),
      todos: booleanoDeConsulta.optional(),
    }),
  );
  const lista = await calcularRetoques({ patientId: q.patientId, margenDias: q.margenDias, todos: q.todos, locale: idiomaDe(req) });
  return {
    items: lista.map((r) => ({
      ...r,
      mensaje: textoParaClienta('retoque', { nombre: r.patientName, servicio: r.serviceNameClienta, idioma: enumDeLocale(r.preferredLocale) }),
    })),
  };
});

const marcaSchema = z.object({
  patientId: z.string().min(1),
  serviceId: z.string().min(1),
  /** Día de la última vez (AAAA-MM-DD), el mismo que viene en la lista. */
  baseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(TouchUpStatus),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, marcaSchema);
  return marcarRetoque({ ...datos, byId: sesion.sub });
});
