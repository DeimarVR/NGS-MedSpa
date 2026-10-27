import { NextResponse } from 'next/server';
import writeXlsxFile from 'write-excel-file/node';
import type { Cell } from 'write-excel-file/node';
import type { Traductor } from '../../i18n';

/**
 * Exportar a Excel. Las hojas se arman con celdas tipadas (número, fecha,
 * dinero) para que en Excel se puedan sumar y ordenar, no texto que parece
 * número.
 */
export type Celda = Cell;

export interface Hoja {
  nombre: string;
  anchos: number[];
  filas: Celda[][];
}

export const FORMATO_DOLAR = '"$"#,##0.00';
export const FORMATO_FECHA = 'mm/dd/yyyy';
export const FORMATO_FECHA_HORA = 'mm/dd/yyyy hh:mm';

export const texto = (value: string | null | undefined): Celda => {
  const limpio = value?.trim();
  return limpio ? { type: String, value: limpio } : null;
};
export const numero = (value: number | null | undefined, format = '0.###'): Celda =>
  value === null || value === undefined ? null : { type: Number, value, format };
/** Centavos → dólares con formato. */
export const dolares = (centavos: number | null | undefined): Celda =>
  centavos === null || centavos === undefined ? null : { type: Number, value: centavos / 100, format: FORMATO_DOLAR };
/** Fecha sin hora (guardada a medianoche UTC). */
export const dia = (value: Date | null | undefined): Celda =>
  value ? { type: Date, value: new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())), format: FORMATO_FECHA } : null;
/** Un instante, mostrado en la hora de la clínica. */
export const instante = (value: Date | null | undefined, zona: string): Celda => {
  if (!value) return null;
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { type: Date, value: new Date(Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'))), format: FORMATO_FECHA_HORA };
};
export const titulo = (value: string): Celda => ({ value, fontWeight: 'bold' });

export function titulos(t: Traductor, claves: string[]): Celda[] {
  return claves.map((c) => titulo(t(c)));
}

export async function armarExcel(hojas: Hoja[]): Promise<Buffer> {
  const salida = writeXlsxFile(
    hojas.map((hoja) => ({
      data: hoja.filas,
      sheet: hoja.nombre.slice(0, 31),
      columns: hoja.anchos.map((width) => ({ width })),
    })),
  );
  return salida.toBuffer();
}

export function respuestaDeDescarga(archivo: Buffer, nombre: string): NextResponse {
  const escapado = encodeURIComponent(nombre);
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombre.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${escapado}`,
      'Content-Length': String(archivo.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
