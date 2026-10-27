import { DocumentStatus, DocumentType } from '@/generated/prisma/client';
import { dinero } from '@/lib/format';
import { env } from '../../config/env';
import { idiomaDeEnum, intlDe, traductor } from '../../i18n';
import { leerAjustes } from '../../ajustes';
import { ANCHO, LINEA, Lienzo, MARGEN, ORO, SUAVE, bytesDePng, idiomaDelPdf } from '../pdf/lienzo';
import { rgb } from 'pdf-lib';
import { obtener } from './invoices.service';

type Documento = Awaited<ReturnType<typeof obtener>>;

/**
 * El recibo o la cotización en PDF, en el idioma del documento (es, en o fr;
 * árabe y japonés salen en inglés, ver `pdf/lienzo.ts`).
 *
 * A diferencia del consentimiento, este PDF se arma cada vez que se pide: el
 * documento puede cambiar (un pago nuevo, una anulación) y el PDF lo refleja.
 */
export async function pdfDeDocumento(documento: Documento): Promise<Uint8Array> {
  const locale = idiomaDelPdf(idiomaDeEnum(documento.locale));
  const t = traductor(locale);
  const intl = intlDe(locale);
  const usd = (c: number) => dinero(c, intl);
  const fechaDia = (d: Date) => new Intl.DateTimeFormat(intl, { timeZone: 'UTC', dateStyle: 'long' }).format(d);
  const fechaPago = (d: Date) => new Intl.DateTimeFormat(intl, { timeZone: env.CLINIC_TIMEZONE, dateStyle: 'medium' }).format(d);
  const ajustes = await leerAjustes(['telefono', 'notaRecibo']);

  const esRecibo = documento.type === DocumentType.RECIBO;
  const titulo = t(esRecibo ? 'docs.recibo.titulo' : 'docs.recibo.tituloCotizacion');
  const numero = `${documento.series}-${String(documento.number).padStart(5, '0')}`;

  const hoja = await Lienzo.crear();
  hoja.membrete(env.CLINIC_NAME, env.CLINIC_ADDRESS, ajustes.telefono);
  hoja.regla(2);

  // Título y número
  hoja.asegurar(40);
  hoja.en(MARGEN, titulo.toUpperCase(), { tamano: 14, fuente: hoja.negrita });
  hoja.derecha(numero, { tamano: 14, fuente: hoja.negrita, color: ORO });
  hoja.espacio(22);
  hoja.en(MARGEN, `${t('docs.recibo.fecha')}: ${fechaDia(documento.issueDate)}`, { tamano: 10, color: SUAVE });
  if (documento.status === DocumentStatus.ANULADA) {
    hoja.derecha(t('docs.recibo.anulado').toUpperCase(), { tamano: 10, fuente: hoja.negrita, color: rgb(0.75, 0.15, 0.15) });
  } else if (esRecibo && documento.status === DocumentStatus.PAGADA) {
    hoja.derecha(t('docs.recibo.pagado').toUpperCase(), { tamano: 10, fuente: hoja.negrita, color: rgb(0.1, 0.5, 0.3) });
  }
  hoja.espacio(22);

  // Clienta
  hoja.parrafo(t('docs.recibo.para').toUpperCase(), { tamano: 8.5, fuente: hoja.negrita, color: SUAVE });
  hoja.parrafo(documento.clientName, { tamano: 11, fuente: hoja.negrita });
  const contacto = [documento.clientPhone, documento.clientEmail].filter(Boolean).join(' · ');
  if (contacto) hoja.parrafo(contacto, { tamano: 9.5, color: SUAVE });
  hoja.espacio(14);

  // Tabla de líneas: descripción | cant. | precio | total
  const xCant = ANCHO - MARGEN - 250;
  const xPrecio = ANCHO - MARGEN - 110;
  const xTotal = ANCHO - MARGEN;
  const anchoDescripcion = xCant - MARGEN - 40;
  hoja.asegurar(24);
  hoja.pagina.drawRectangle({ x: MARGEN, y: hoja.y - 20, width: hoja.anchoUtil, height: 20, color: rgb(0.96, 0.97, 0.98) });
  hoja.espacio(5);
  hoja.en(MARGEN + 8, t('docs.recibo.descripcion'), { tamano: 8.5, fuente: hoja.negrita, color: SUAVE });
  hoja.derecha(t('docs.recibo.cantidad'), { tamano: 8.5, fuente: hoja.negrita, color: SUAVE, x: xCant });
  hoja.derecha(t('docs.recibo.precio'), { tamano: 8.5, fuente: hoja.negrita, color: SUAVE, x: xPrecio });
  hoja.derecha(t('docs.recibo.importe'), { tamano: 8.5, fuente: hoja.negrita, color: SUAVE, x: xTotal - 8 });
  hoja.espacio(22);

  for (const linea of documento.items) {
    hoja.asegurar(18);
    const yFila = hoja.y;
    hoja.derecha(String(linea.quantity), { tamano: 10, x: xCant });
    hoja.derecha(usd(linea.unitPrice), { tamano: 10, x: xPrecio });
    hoja.derecha(usd(linea.total), { tamano: 10, x: xTotal - 8 });
    hoja.parrafo(linea.description, { tamano: 10, sangria: 8, ancho: anchoDescripcion + 8 });
    if (hoja.y > yFila - 16) hoja.y = yFila - 16;
    hoja.espacio(3);
    hoja.pagina.drawLine({ start: { x: MARGEN, y: hoja.y }, end: { x: ANCHO - MARGEN, y: hoja.y }, thickness: 0.5, color: LINEA });
    hoja.espacio(7);
  }

  // Totales
  const filaTotal = (etiqueta: string, valor: string, fuerte = false) => {
    hoja.asegurar(18);
    hoja.derecha(etiqueta, { tamano: fuerte ? 11 : 10, fuente: fuerte ? hoja.negrita : hoja.normal, color: fuerte ? undefined : SUAVE, x: xPrecio });
    hoja.derecha(valor, { tamano: fuerte ? 11 : 10, fuente: fuerte ? hoja.negrita : hoja.normal, x: xTotal - 8 });
    hoja.espacio(fuerte ? 20 : 16);
  };
  hoja.espacio(4);
  filaTotal(t('docs.recibo.subtotal'), usd(documento.subtotal));
  if (documento.discount > 0) filaTotal(t('docs.recibo.descuento'), `-${usd(documento.discount)}`);
  if (documento.taxRateBps > 0 || documento.tax > 0) {
    const tasa = new Intl.NumberFormat(intl, { maximumFractionDigits: 3 }).format(documento.taxRateBps / 100);
    filaTotal(t('docs.recibo.impuesto', { tasa }), usd(documento.tax));
  }
  filaTotal(t('docs.recibo.total'), usd(documento.total), true);
  if (esRecibo && documento.payments.length > 0) {
    filaTotal(t('docs.recibo.abonado'), usd(documento.deposit));
    filaTotal(t('docs.recibo.saldo'), usd(documento.balance), true);
  }

  // Pagos recibidos
  if (esRecibo && documento.payments.length > 0) {
    hoja.espacio(8);
    hoja.asegurar(20 + documento.payments.length * 15);
    hoja.parrafo(t('docs.recibo.pagos').toUpperCase(), { tamano: 8.5, fuente: hoja.negrita, color: SUAVE });
    hoja.espacio(2);
    for (const pago of documento.payments) {
      hoja.asegurar(15);
      hoja.en(MARGEN, `${fechaPago(pago.paidAt)} · ${t(`estados.pago.${pago.method}`)}${pago.reference ? ` · ${pago.reference}` : ''}`, { tamano: 9.5 });
      hoja.derecha(usd(pago.amount), { tamano: 9.5, x: xTotal - 8 });
      hoja.espacio(15);
    }
  }

  if (!esRecibo) {
    hoja.espacio(10);
    hoja.parrafo(t('docs.recibo.validez'), { tamano: 9, fuente: hoja.cursiva, color: SUAVE });
  }

  if (documento.notes) {
    hoja.espacio(10);
    hoja.parrafo(t('docs.recibo.notas').toUpperCase(), { tamano: 8.5, fuente: hoja.negrita, color: SUAVE });
    hoja.parrafo(documento.notes, { tamano: 9.5 });
  }

  // Firma de quien elabora
  const firma = bytesDePng(documento.signature);
  if (firma) {
    const imagen = await hoja.pdf.embedPng(firma);
    const ancho = 150;
    const alto = Math.min((imagen.height / imagen.width) * ancho, 60);
    hoja.espacio(18);
    hoja.asegurar(alto + 40);
    hoja.pagina.drawImage(imagen, { x: MARGEN, y: hoja.y - alto, width: ancho, height: alto });
    hoja.espacio(alto + 4);
    hoja.pagina.drawLine({ start: { x: MARGEN, y: hoja.y }, end: { x: MARGEN + 200, y: hoja.y }, thickness: 0.75, color: rgb(0.6, 0.64, 0.68) });
    hoja.espacio(10);
    if (documento.signedBy) hoja.parrafo(documento.signedBy, { tamano: 9.5, fuente: hoja.negrita });
  }

  if (ajustes.notaRecibo.trim()) {
    hoja.espacio(14);
    hoja.parrafo(ajustes.notaRecibo, { tamano: 8.5, color: SUAVE });
  }

  hoja.pie(`${env.CLINIC_NAME} · ${titulo} ${numero}`, (n, total) => t('docs.pagina', { n, total }));
  hoja.pdf.setTitle(`${titulo} ${numero} - ${documento.clientName}`);
  hoja.pdf.setProducer(env.CLINIC_NAME);
  return hoja.pdf.save();
}
