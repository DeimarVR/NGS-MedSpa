import { env } from '../../config/env';
import { formatLong } from '../../lib/datetime';
import { intlDe, traductor } from '../../i18n';
import type { Locale } from '@/i18n/routing';
import { Lienzo, SUAVE, MARGEN, partirEnLineas, idiomaDelPdf } from '../pdf/lienzo';
import { rgb } from 'pdf-lib';

/**
 * El PDF de un consentimiento firmado: la plantilla, los datos de la clienta y
 * la hoja de firma. Es un documento CERRADO: se guarda y no se regenera.
 */
export interface DatosDocumento {
  templateName: string;
  version: number;
  body: string;
  locale: Locale;
  patientName: string;
  patientBirthDate: Date | null;
  professionalName: string | null;
  signedAt: Date;
  signaturePng: Uint8Array;
  notes: string | null;
  telefono?: string;
}

/** Una línea en MAYÚSCULAS (o que empieza por «# ») es un título; una que empieza por «-», una viñeta. */
function escribirCuerpo(hoja: Lienzo, cuerpo: string) {
  for (const crudo of cuerpo.replace(/\r\n?/g, '\n').split('\n')) {
    const linea = crudo.trim();
    if (!linea) {
      hoja.espacio(7);
      continue;
    }
    if (/^[-*•]\s+/.test(linea)) {
      hoja.vineta(linea.replace(/^[-*•]\s+/, ''));
      continue;
    }
    const marcado = /^#+\s+/.test(linea);
    const letras = linea.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    if (marcado || (letras.length >= 3 && letras === letras.toUpperCase() && linea.length <= 90)) {
      hoja.espacio(8);
      hoja.asegurar(30);
      hoja.parrafo(linea.replace(/^#+\s+/, ''), { tamano: 10.5, fuente: hoja.negrita });
      hoja.espacio(2);
      continue;
    }
    hoja.parrafo(linea);
    hoja.espacio(3);
  }
}

export async function armarPdf(datos: DatosDocumento): Promise<Uint8Array> {
  const locale = idiomaDelPdf(datos.locale);
  const t = traductor(locale);
  const intl = intlDe(locale);
  const cuando = formatLong(datos.signedAt, env.CLINIC_TIMEZONE, intl);

  const hoja = await Lienzo.crear();
  hoja.membrete(env.CLINIC_NAME, env.CLINIC_ADDRESS, datos.telefono);
  hoja.regla(2);

  hoja.parrafo(datos.templateName.toUpperCase(), { tamano: 12.5, fuente: hoja.negrita });
  hoja.espacio(6);
  hoja.parrafo(`${t('docs.consentimiento.clienta')}: ${datos.patientName}`);
  if (datos.patientBirthDate) {
    hoja.parrafo(
      `${t('docs.consentimiento.nacimiento')}: ${new Intl.DateTimeFormat(intl, { timeZone: 'UTC', dateStyle: 'long' }).format(datos.patientBirthDate)}`,
    );
  }
  hoja.parrafo(`${t('docs.consentimiento.fecha')}: ${cuando}`);
  hoja.parrafo(`${t('docs.consentimiento.version')}: ${datos.version}`, { tamano: 9.5, color: SUAVE });
  hoja.regla(12);

  escribirCuerpo(hoja, datos.body);

  // Hoja de firma: se calcula todo lo que ocupa para no partirla en dos páginas.
  const firma = await hoja.pdf.embedPng(datos.signaturePng);
  const anchoFirma = 210;
  const altoFirma = Math.min((firma.height / firma.width) * anchoFirma, 90);
  const declaracion = t('docs.consentimiento.declaracion');
  const lineas = (texto: string, tamano: number) => partirEnLineas(texto, hoja.normal, tamano, hoja.anchoUtil).length * (tamano + 5);
  let necesario = 24 + lineas(declaracion, 10) + 30 + altoFirma + 6 + 14 + 15.5 + 14 + 12 + 14.5;
  if (datos.professionalName) necesario += 14.5;
  if (datos.notes) necesario += 4 + lineas(datos.notes, 9.5);
  hoja.asegurar(necesario);

  hoja.espacio(24);
  hoja.parrafo(declaracion, { tamano: 10, color: SUAVE });
  hoja.espacio(30);
  hoja.pagina.drawImage(firma, { x: MARGEN, y: hoja.y - altoFirma, width: anchoFirma, height: altoFirma });
  hoja.espacio(altoFirma + 6);
  hoja.pagina.drawLine({ start: { x: MARGEN, y: hoja.y }, end: { x: MARGEN + anchoFirma + 60, y: hoja.y }, thickness: 1, color: rgb(0.6, 0.64, 0.68) });
  hoja.espacio(14);
  hoja.parrafo(datos.patientName, { tamano: 10.5, fuente: hoja.negrita });
  hoja.parrafo(t('docs.consentimiento.firmaClienta'), { tamano: 9, color: SUAVE });
  hoja.espacio(12);
  hoja.parrafo(t('docs.consentimiento.firmadoEl', { cuando }), { tamano: 9.5, color: SUAVE });
  if (datos.professionalName) hoja.parrafo(t('docs.consentimiento.atendidoPor', { nombre: datos.professionalName }), { tamano: 9.5, color: SUAVE });
  if (datos.notes) {
    hoja.espacio(4);
    hoja.parrafo(`${t('docs.consentimiento.observaciones')}: ${datos.notes}`, { tamano: 9.5, fuente: hoja.cursiva, color: SUAVE });
  }

  hoja.pie(`${env.CLINIC_NAME} · ${datos.templateName}`, (n, total) => t('docs.pagina', { n, total }));
  hoja.pdf.setTitle(`${datos.templateName} - ${datos.patientName}`);
  hoja.pdf.setProducer(env.CLINIC_NAME);
  hoja.pdf.setCreationDate(datos.signedAt);
  return hoja.pdf.save();
}
