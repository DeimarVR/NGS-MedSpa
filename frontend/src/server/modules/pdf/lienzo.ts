import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { Locale } from '@/i18n/routing';

/**
 * Herramientas comunes de los PDF (consentimientos, recibos, cotizaciones).
 *
 * pdf-lib con las fuentes estándar (Helvetica) solo dibuja el alfabeto latino
 * (WinAnsi): español, inglés y francés salen con todas sus tildes; árabe y
 * japonés NO se pueden dibujar así (el árabe además necesita unir letras y
 * escribir de derecha a izquierda, que pdf-lib no hace). Por eso los
 * documentos de una clienta en árabe o japonés salen en inglés.
 */
export const IDIOMAS_PDF: Locale[] = ['es', 'en', 'fr'];

export function idiomaDelPdf(locale: Locale): Locale {
  return IDIOMAS_PDF.includes(locale) ? locale : 'en';
}

export const ANCHO = 612; // Carta, en puntos.
export const ALTO = 792;
export const MARGEN = 56;
const SUELO = MARGEN + 34;

export const TINTA = rgb(0.06, 0.1, 0.18);
export const SUAVE = rgb(0.4, 0.44, 0.5);
export const LINEA = rgb(0.86, 0.88, 0.91);
export const ORO = rgb(0.61, 0.42, 0.33);

/**
 * Deja solo lo que Helvetica sabe dibujar (Latin-1 + comillas y rayas
 * tipográficas que WinAnsi sí trae). Un carácter fuera de la tabla haría
 * fallar el PDF entero con la clienta delante.
 */
export function aWinAnsi(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/ | | /g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF–—•€Œœ]/g, '');
}

export function partirEnLineas(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const palabras = aWinAnsi(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(tentativa, tamano) <= ancho) {
      actual = tentativa;
      continue;
    }
    if (actual) lineas.push(actual);
    if (fuente.widthOfTextAtSize(palabra, tamano) > ancho) {
      let resto = palabra;
      while (fuente.widthOfTextAtSize(resto, tamano) > ancho) {
        let corte = resto.length - 1;
        while (corte > 1 && fuente.widthOfTextAtSize(resto.slice(0, corte), tamano) > ancho) corte -= 1;
        lineas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      actual = resto;
    } else {
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Una hoja que crece: pasa de página sola cuando no cabe lo que viene. */
export class Lienzo {
  pagina: PDFPage;
  y: number;
  readonly paginas: PDFPage[] = [];

  constructor(
    readonly pdf: PDFDocument,
    readonly normal: PDFFont,
    readonly negrita: PDFFont,
    readonly cursiva: PDFFont,
  ) {
    this.pagina = this.abrir();
    this.y = ALTO - MARGEN;
  }

  static async crear(): Promise<Lienzo> {
    const pdf = await PDFDocument.create();
    return new Lienzo(
      pdf,
      await pdf.embedFont(StandardFonts.Helvetica),
      await pdf.embedFont(StandardFonts.HelveticaBold),
      await pdf.embedFont(StandardFonts.HelveticaOblique),
    );
  }

  private abrir(): PDFPage {
    const pagina = this.pdf.addPage([ANCHO, ALTO]);
    this.paginas.push(pagina);
    return pagina;
  }

  get anchoUtil(): number {
    return ANCHO - MARGEN * 2;
  }

  asegurar(alto: number) {
    if (this.y - alto >= SUELO) return;
    this.pagina = this.abrir();
    this.y = ALTO - MARGEN;
  }

  espacio(alto: number) {
    this.y -= alto;
  }

  parrafo(
    texto: string,
    opciones: { tamano?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb>; sangria?: number; interlineado?: number; ancho?: number } = {},
  ) {
    const tamano = opciones.tamano ?? 10.5;
    const fuente = opciones.fuente ?? this.normal;
    const color = opciones.color ?? TINTA;
    const sangria = opciones.sangria ?? 0;
    const alto = opciones.interlineado ?? tamano + 5;
    for (const linea of partirEnLineas(texto, fuente, tamano, (opciones.ancho ?? this.anchoUtil) - sangria)) {
      this.asegurar(alto);
      this.pagina.drawText(linea, { x: MARGEN + sangria, y: this.y - tamano, size: tamano, font: fuente, color });
      this.y -= alto;
    }
  }

  /** Texto alineado a la derecha en la línea actual (no avanza). */
  derecha(texto: string, opciones: { tamano?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {}) {
    const tamano = opciones.tamano ?? 10.5;
    const fuente = opciones.fuente ?? this.normal;
    const limpio = aWinAnsi(texto);
    const fin = opciones.x ?? ANCHO - MARGEN;
    this.pagina.drawText(limpio, { x: fin - fuente.widthOfTextAtSize(limpio, tamano), y: this.y - tamano, size: tamano, font: fuente, color: opciones.color ?? TINTA });
  }

  /** Texto en una x fija de la línea actual (no avanza). */
  en(x: number, texto: string, opciones: { tamano?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb> } = {}) {
    const tamano = opciones.tamano ?? 10.5;
    this.pagina.drawText(aWinAnsi(texto), { x, y: this.y - tamano, size: tamano, font: opciones.fuente ?? this.normal, color: opciones.color ?? TINTA });
  }

  vineta(texto: string, tamano = 10.5) {
    this.asegurar(tamano + 5);
    this.pagina.drawText('•', { x: MARGEN + 4, y: this.y - tamano, size: tamano, font: this.normal, color: SUAVE });
    this.parrafo(texto, { tamano, sangria: 18 });
  }

  regla(margenSuperior = 0, color = LINEA) {
    this.espacio(margenSuperior);
    this.asegurar(12);
    this.pagina.drawLine({ start: { x: MARGEN, y: this.y }, end: { x: ANCHO - MARGEN, y: this.y }, thickness: 1, color });
    this.espacio(12);
  }

  /** Encabezado con la marca de la clínica. */
  membrete(nombre: string, direccion: string, telefono?: string) {
    // Marca: un cuadro en oro rosa con «NGS», como el logo del sitio.
    this.pagina.drawRectangle({ x: MARGEN, y: this.y - 34, width: 34, height: 34, color: ORO });
    const marca = 'NGS';
    this.pagina.drawText(marca, { x: MARGEN + 17 - this.negrita.widthOfTextAtSize(marca, 10) / 2, y: this.y - 21, size: 10, font: this.negrita, color: rgb(1, 1, 1) });
    this.pagina.drawText(aWinAnsi(nombre), { x: MARGEN + 44, y: this.y - 15, size: 15, font: this.negrita, color: TINTA });
    const linea2 = [direccion, telefono].filter(Boolean).join(' · ');
    if (linea2) this.pagina.drawText(aWinAnsi(linea2), { x: MARGEN + 44, y: this.y - 30, size: 8.5, font: this.normal, color: SUAVE });
    this.espacio(44);
  }

  /** Pie en todas las páginas: título y «Página x de n». */
  pie(izquierda: string, pagina: (n: number, total: number) => string) {
    const total = this.paginas.length;
    this.paginas.forEach((p, i) => {
      p.drawLine({ start: { x: MARGEN, y: MARGEN - 6 }, end: { x: ANCHO - MARGEN, y: MARGEN - 6 }, thickness: 0.5, color: LINEA });
      p.drawText(aWinAnsi(izquierda), { x: MARGEN, y: MARGEN - 20, size: 8, font: this.normal, color: SUAVE });
      const d = aWinAnsi(pagina(i + 1, total));
      p.drawText(d, { x: ANCHO - MARGEN - this.normal.widthOfTextAtSize(d, 8), y: MARGEN - 20, size: 8, font: this.normal, color: SUAVE });
    });
  }
}

/** PNG en data URL → bytes (las firmas). */
export function bytesDePng(dataUrl: string | null | undefined): Uint8Array | null {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl?.trim() ?? '');
  return m ? Buffer.from(m[1], 'base64') : null;
}
