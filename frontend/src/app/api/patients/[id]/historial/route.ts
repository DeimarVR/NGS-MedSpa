import { StockMoveType } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { requireAuth, route, t } from '@/server/http';
import type { Hecho } from '@/lib/types';
import { idiomaDe } from '@/server/i18n';
import { traducirTratamientos } from '@/server/modules/treatments/traduccion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Todo lo que le ha pasado a la clienta, en una sola línea de tiempo: mapas
 * faciales, fichas de piel, consentimientos, fotos, productos, citas y recibos.
 * Los enlaces van SIN idioma (/admin/...): el panel les pone el suyo.
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const tr = t(req);
  const patientId = params.id;

  const [mapasCrudos, faciales, consentimientos, fotos, productos, citasCrudas, recibos] = await Promise.all([
    prisma.clinicalRecord.findMany({
      where: { patientId },
      select: { id: true, procedureDate: true, service: { select: { name: true, translations: true } }, _count: { select: { entries: true } } },
    }),
    prisma.facialRecord.findMany({
      where: { patientId },
      select: { id: true, openedAt: true, skinCondition: true, _count: { select: { entries: true } } },
    }),
    prisma.signedConsent.findMany({ where: { patientId }, select: { id: true, templateName: true, templateVersion: true, signedAt: true, fileUrl: true } }),
    prisma.photoRecord.findMany({ where: { patientId }, select: { id: true, title: true, createdAt: true, _count: { select: { photos: true } } } }),
    prisma.stockMove.findMany({
      where: { patientId, type: StockMoveType.SALIDA },
      select: { id: true, occurredAt: true, quantity: true, product: { select: { name: true, unit: true } }, lot: { select: { lotNumber: true } } },
    }),
    prisma.appointment.findMany({ where: { patientId }, select: { id: true, startsAt: true, status: true, service: { select: { name: true, translations: true } } } }),
    prisma.invoice.findMany({ where: { patientId }, select: { id: true, number: true, series: true, issueDate: true, total: true, status: true, type: true } }),
  ]);

  const locale = idiomaDe(req);
  const mapas = traducirTratamientos(mapasCrudos, locale);
  const citas = traducirTratamientos(citasCrudas, locale);
  const hechos: Hecho[] = [
    ...mapas.map((m) => ({
      id: m.id,
      tipo: 'mapa' as const,
      fecha: m.procedureDate.toISOString(),
      titulo: m.service?.name ?? tr('api.historial.mapa'),
      detalle: tr('api.historial.puntos', { n: m._count.entries }),
      enlace: `/admin/mapa-facial/${m.id}`,
    })),
    ...faciales.map((f) => ({
      id: f.id,
      tipo: 'ficha-facial' as const,
      fecha: f.openedAt.toISOString(),
      titulo: tr('api.historial.fichaPiel'),
      detalle: [f.skinCondition, tr('api.historial.sesiones', { n: f._count.entries })].filter(Boolean).join(' · '),
      enlace: `/admin/mapa-facial/piel/${f.id}`,
    })),
    ...consentimientos.map((c) => ({
      id: c.id,
      tipo: 'consentimiento' as const,
      fecha: c.signedAt.toISOString(),
      titulo: c.templateName,
      detalle: tr('api.historial.firmado', { version: c.templateVersion }),
      enlace: c.fileUrl,
    })),
    ...fotos.map((r) => ({
      id: r.id,
      tipo: 'fotos' as const,
      fecha: r.createdAt.toISOString(),
      titulo: r.title,
      detalle: tr('api.historial.fotos', { n: r._count.photos }),
      enlace: `/admin/fotos?clienta=${patientId}`,
    })),
    ...productos.map((m) => ({
      id: m.id,
      tipo: 'producto' as const,
      fecha: m.occurredAt.toISOString(),
      titulo: m.product.name,
      detalle: `${m.quantity} ${m.product.unit}${m.lot ? ` · ${tr('api.historial.lote')} ${m.lot.lotNumber}` : ''}`,
    })),
    ...citas.map((c) => ({
      id: c.id,
      tipo: 'cita' as const,
      fecha: c.startsAt.toISOString(),
      titulo: c.service?.name ?? tr('api.historial.cita'),
      detalle: tr(`estados.cita.${c.status}`),
      enlace: `/admin/citas?cita=${c.id}`,
    })),
    ...recibos.map((f) => ({
      id: f.id,
      tipo: 'recibo' as const,
      fecha: f.issueDate.toISOString(),
      titulo: `${tr(`estados.documento.${f.type}`)} ${f.series}-${f.number}`,
      detalle: tr(`estados.recibo.${f.status}`),
      enlace: `/admin/recibos/${f.id}`,
    })),
  ];

  hechos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { items: hechos };
});
