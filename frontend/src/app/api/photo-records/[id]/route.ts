import { Role } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { comprobarFilasPropias, comprobarMismoPaciente, comprobarVersion, versionTomada } from '@/server/lib/envioUnico';
import { borrarArchivosSinUso } from '@/server/storage';
import { CON_FOTOS, registroSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const registro = await prisma.photoRecord.findUnique({ where: { id: params.id }, include: CON_FOTOS });
  if (!registro) throw HttpError.notFound('api.fotos.noEncontrado');
  return registro;
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const datos = await body(req, registroSchema);

  const existente = await prisma.photoRecord.findUnique({
    where: { id: params.id },
    select: { id: true, patientId: true, updatedAt: true, patient: { select: { photoConsent: true } }, photos: { select: { id: true, url: true } } },
  });
  if (!existente) throw HttpError.notFound('api.fotos.noEncontrado');
  comprobarVersion(datos.version, existente.updatedAt);
  comprobarMismoPaciente(datos.patientId, existente.patientId);
  comprobarFilasPropias(
    existente.photos.map((foto) => foto.id),
    datos.fotos.map((foto) => foto.id),
  );
  if (datos.publishable && !existente.patient.photoConsent) throw HttpError.unprocessable('api.fotos.sinConsentimiento');

  // Las fotos se cotejan POR ID: borrar y recrear cambiaría sus ids y dejaría archivos huérfanos.
  const llegan = new Set(datos.fotos.map((foto) => foto.id).filter(Boolean));
  const aBorrar = existente.photos.filter((foto) => !llegan.has(foto.id)).map((foto) => foto.id);

  await prisma.$transaction(
    async (tx) => {
      const { count } = await tx.photoRecord.updateMany({
        where: { id: existente.id, updatedAt: existente.updatedAt },
        data: {
          serviceId: datos.serviceId || null,
          title: datos.title,
          notes: datos.notes || null,
          consentSigned: datos.consentSigned,
          publishable: datos.publishable,
          updatedAt: new Date(),
        },
      });
      versionTomada(count);
      if (aBorrar.length > 0) await tx.photoRecordItem.deleteMany({ where: { id: { in: aBorrar } } });
      for (const [indice, foto] of datos.fotos.entries()) {
        const comun = {
          url: foto.url,
          type: foto.type,
          angle: foto.angle,
          caption: foto.caption || null,
          ...(foto.takenAt ? { takenAt: new Date(foto.takenAt) } : {}),
          sortOrder: foto.sortOrder || indice,
        };
        if (foto.id) await tx.photoRecordItem.update({ where: { id: foto.id }, data: comun });
        else await tx.photoRecordItem.create({ data: { ...comun, recordId: existente.id } });
      }
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  await borrarArchivosSinUso(existente.photos.filter((f) => aBorrar.includes(f.id)).map((f) => f.url));
  return prisma.photoRecord.findUnique({ where: { id: existente.id }, include: CON_FOTOS });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  // Borrar material clínico no es cosa de cualquiera con sesión.
  requireRole(req, Role.ADMIN);
  const fotos = await prisma.photoRecordItem.findMany({ where: { recordId: params.id }, select: { url: true } });
  await prisma.photoRecord.delete({ where: { id: params.id } });
  await borrarArchivosSinUso(fotos.map((f) => f.url));
  return { ok: true };
});
