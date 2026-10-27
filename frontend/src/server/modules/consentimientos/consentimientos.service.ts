import { ConsentKind, type Idioma } from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { construirClave, guardarObjeto } from '../../storage';
import { leerAjuste } from '../../ajustes';
import { localeDeEnum } from '@/lib/idiomas';
import { armarPdf } from './documento';
import { idiomaDelPdf } from '../pdf/lienzo';

/**
 * Consentimientos: plantillas (por idioma) y documentos firmados.
 *
 * Los textos de ejemplo que trae el seed son un PUNTO DE PARTIDA: la clínica
 * debe revisarlos con su abogado antes de usarlos con clientas.
 */
export interface PlantillaEntrada {
  name: string;
  description?: string | null;
  kind: ConsentKind;
  locale: Idioma;
  body: string;
  serviceIds: string[];
  active?: boolean;
}

export function listarPlantillas(incluirInactivas = false) {
  return prisma.consentTemplate.findMany({
    where: incluirInactivas ? {} : { active: true },
    include: { services: { select: { id: true, name: true } }, _count: { select: { signatures: true } } },
    orderBy: [{ kind: 'asc' }, { locale: 'asc' }, { name: 'asc' }],
  });
}

export function crearPlantilla(datos: PlantillaEntrada, createdById?: string) {
  return prisma.consentTemplate.create({
    data: {
      name: datos.name.trim(),
      description: datos.description?.trim() || null,
      kind: datos.kind,
      locale: datos.locale,
      body: datos.body.trim(),
      createdById: createdById ?? null,
      services: { connect: datos.serviceIds.map((id) => ({ id })) },
    },
    include: { services: { select: { id: true, name: true } } },
  });
}

/** Si cambia el TEXTO, sube la versión: cada firma dice qué versión firmó. */
export async function actualizarPlantilla(id: string, datos: PlantillaEntrada) {
  const existente = await prisma.consentTemplate.findUnique({ where: { id }, select: { id: true, body: true, version: true } });
  if (!existente) throw HttpError.notFound('api.consentimientos.plantillaNoEncontrada');
  const cuerpo = datos.body.trim();
  return prisma.consentTemplate.update({
    where: { id },
    data: {
      name: datos.name.trim(),
      description: datos.description?.trim() || null,
      kind: datos.kind,
      locale: datos.locale,
      body: cuerpo,
      ...(cuerpo !== existente.body ? { version: existente.version + 1 } : {}),
      ...(datos.active === undefined ? {} : { active: datos.active }),
      services: { set: datos.serviceIds.map((sid) => ({ id: sid })) },
    },
    include: { services: { select: { id: true, name: true } } },
  });
}

export async function archivarPlantilla(id: string, activa: boolean) {
  await prisma.consentTemplate.update({ where: { id }, data: { active: activa } });
  return { activa };
}

export async function eliminarPlantilla(id: string) {
  const plantilla = await prisma.consentTemplate.findUnique({ where: { id }, select: { id: true, active: true } });
  if (!plantilla) throw HttpError.notFound('api.consentimientos.plantillaNoEncontrada');
  if (plantilla.active) throw HttpError.unprocessable('api.consentimientos.archivarAntes');
  // Las firmas sobreviven: su plantilla queda en null y conservan su PDF.
  await prisma.consentTemplate.delete({ where: { id } });
  return { borrado: true };
}

export interface FirmaEntrada {
  templateId: string;
  patientId: string;
  signature: string;
  signedAt: Date;
  professionalName?: string | null;
  notes?: string | null;
  templateVersion?: number;
}

export async function firmar(datos: FirmaEntrada, usuarioId?: string) {
  const [plantilla, clienta] = await Promise.all([
    prisma.consentTemplate.findUnique({ where: { id: datos.templateId } }),
    prisma.patient.findUnique({ where: { id: datos.patientId }, select: { id: true, fullName: true, birthDate: true } }),
  ]);
  if (!plantilla) throw HttpError.notFound('api.consentimientos.plantillaNoEncontrada');
  if (!plantilla.active) throw HttpError.unprocessable('api.consentimientos.archivada');
  if (!plantilla.body.trim()) throw HttpError.unprocessable('api.consentimientos.sinTexto');
  if (!clienta) throw HttpError.notFound('api.clientas.noEncontrada');
  // El texto cambió mientras la clienta lo tenía en pantalla: que firme el nuevo.
  if (datos.templateVersion !== undefined && datos.templateVersion !== plantilla.version) {
    throw HttpError.conflict('api.consentimientos.versionCambio');
  }

  const m = /^data:image\/png;base64,(.+)$/.exec(datos.signature.trim());
  if (!m) throw HttpError.unprocessable('api.consentimientos.firmaFormato');

  let pdf: Uint8Array;
  try {
    pdf = await armarPdf({
      templateName: plantilla.name,
      version: plantilla.version,
      body: plantilla.body,
      locale: idiomaDelPdf(localeDeEnum(plantilla.locale)),
      patientName: clienta.fullName,
      patientBirthDate: clienta.birthDate,
      professionalName: datos.professionalName ?? null,
      signedAt: datos.signedAt,
      signaturePng: Buffer.from(m[1], 'base64'),
      notes: datos.notes ?? null,
      telefono: await leerAjuste('telefono').catch(() => undefined),
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw HttpError.unprocessable('api.consentimientos.pdfFallo', { detalle: error instanceof Error ? error.message.slice(0, 120) : '' });
  }

  const fileUrl = await guardarObjeto(construirClave('consentimientos', 'application/pdf'), pdf, 'application/pdf');

  const firmado = await prisma.signedConsent.create({
    data: {
      templateId: plantilla.id,
      patientId: clienta.id,
      templateName: plantilla.name,
      templateVersion: plantilla.version,
      kind: plantilla.kind,
      locale: plantilla.locale,
      patientName: clienta.fullName,
      signedAt: datos.signedAt,
      fileUrl,
      signature: datos.signature,
      professionalName: datos.professionalName ?? null,
      signedById: usuarioId ?? null,
      notes: datos.notes ?? null,
    },
    include: { patient: { select: { id: true, fullName: true } } },
  });

  // Firmó el uso de fotos: queda marcado en su ficha.
  if (plantilla.kind === ConsentKind.FOTOS) {
    await prisma.patient.update({ where: { id: clienta.id }, data: { photoConsent: true } });
  }

  return firmado;
}

export function listarFirmados(params: { patientId?: string; take?: number } = {}) {
  return prisma.signedConsent.findMany({
    where: params.patientId ? { patientId: params.patientId } : {},
    omit: { signature: true },
    include: { patient: { select: { id: true, fullName: true } }, signedBy: { select: { fullName: true } } },
    orderBy: { signedAt: 'desc' },
    take: params.take ?? 100,
  });
}
