/**
 * Formatos de fecha, hora, dinero y teléfono, en el idioma de quien mira.
 *
 * Cada función recibe la etiqueta Intl (`es-US`, `ar-u-nu-latn`…) y la zona de
 * la clínica. En componentes de cliente se usan a través de `useFormato()`.
 * La moneda es SIEMPRE dólares; el dinero viaja en centavos.
 */

export const ZONA_POR_DEFECTO = 'America/Chicago';

/** 125000 → «$1,250.00» (en), «1 250,00 $ US» (fr). `null` → «—». */
export function dinero(centavos: number | null | undefined, intl: string, sinCentavos = false): string {
  if (centavos === null || centavos === undefined) return '—';
  return new Intl.NumberFormat(intl, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: sinCentavos ? 0 : 2,
    maximumFractionDigits: sinCentavos ? 0 : 2,
  }).format(centavos / 100);
}

/** «$12.50» → 1250. Acepta coma o punto decimal. Vacío o raro → null. */
export function aCentavos(texto: string | number): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  const limpio = texto.replace(/[^\d.,-]/g, '').trim();
  if (!limpio) return null;
  // «1,250.50» (EE. UU.) o «1.250,50» / «12,5» (coma decimal)
  let normal = limpio;
  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  if (ultimaComa > ultimoPunto) normal = limpio.replace(/\./g, '').replace(',', '.');
  else normal = limpio.replace(/,/g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** 1250 → «12.50», para poner en un campo editable. */
export function centavosATexto(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '';
  return (centavos / 100).toFixed(2).replace(/\.00$/, '');
}

export function numero(valor: number, intl: string, decimales = 2): string {
  return new Intl.NumberFormat(intl, { maximumFractionDigits: decimales }).format(valor);
}

export function fechaLarga(entrada: string | Date, intl: string, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat(intl, { timeZone: zona, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(entrada),
  );
}

export function fechaCorta(entrada: string | Date, intl: string, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat(intl, { timeZone: zona, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(entrada));
}

export function fechaHora(entrada: string | Date, intl: string, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat(intl, { timeZone: zona, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(
    new Date(entrada),
  );
}

export function fechaHoraLarga(entrada: string | Date, intl: string, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat(intl, { timeZone: zona, dateStyle: 'full', timeStyle: 'short' }).format(new Date(entrada));
}

export function hora(entrada: string | Date, intl: string, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat(intl, { timeZone: zona, hour: 'numeric', minute: '2-digit' }).format(new Date(entrada));
}

/**
 * Fecha SIN hora guardada a medianoche UTC («2026-10-27» o su ISO): se lee en
 * UTC para que no se corra un día.
 */
export function fechaDia(clave: string | Date, intl: string, estilo: 'corta' | 'larga' = 'corta'): string {
  const iso = typeof clave === 'string' ? clave.slice(0, 10) : clave.toISOString().slice(0, 10);
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return '';
  return new Intl.DateTimeFormat(
    intl,
    estilo === 'larga'
      ? { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }
      : { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' },
  ).format(new Date(Date.UTC(a, m - 1, d)));
}

export function relativo(entrada: string | Date, intl: string): string {
  const diffMs = new Date(entrada).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
  const unidades: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unidad, ms] of unidades) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unidad);
  }
  return rtf.format(0, 'minute');
}

export function duracion(minutos: number, intl: string): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const f = (valor: number, unidad: 'hour' | 'minute') =>
    new Intl.NumberFormat(intl, { style: 'unit', unit: unidad, unitDisplay: 'short' }).format(valor);
  if (h === 0) return f(m, 'minute');
  return m === 0 ? f(h, 'hour') : `${f(h, 'hour')} ${f(m, 'minute')}`;
}

/** `12145550100` → `(214) 555-0100`; internacional → `+44…`. */
export function telefono(valor: string | null | undefined): string {
  if (!valor) return '—';
  const d = String(valor).replace(/\D/g, '');
  if (!d) return '—';
  const local = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : null;
  if (local) return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  return `+${d}`;
}

/** Enlaces para contactar a la clienta desde el panel (llamar, SMS, WhatsApp). */
export function enlacesDeContacto(valor: string, mensaje?: string) {
  const d = String(valor).replace(/\D/g, '');
  const e164 = d.length === 10 ? `1${d}` : d;
  const texto = mensaje ? encodeURIComponent(mensaje) : '';
  return {
    llamar: `tel:+${e164}`,
    sms: `sms:+${e164}${texto ? `?&body=${texto}` : ''}`,
    whatsapp: `https://wa.me/${e164}${texto ? `?text=${texto}` : ''}`,
  };
}

export function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const espacio = corte.lastIndexOf(' ');
  return `${espacio > max * 0.6 ? corte.slice(0, espacio) : corte}…`;
}

/** «AAAA-MM-DD» de hoy en la clínica. */
export function hoyEnClinica(zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** El día de la clínica al que cae un instante. */
export function diaEnClinica(instante: string | Date, zona = ZONA_POR_DEFECTO): string {
  const fecha = new Date(instante);
  if (Number.isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

/** «HH:mm» de un instante en la clínica. */
export function horaEnClinica(instante: string | Date, zona = ZONA_POR_DEFECTO): string {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(instante),
  );
  return p;
}

/** Suma días a una clave «AAAA-MM-DD» (en UTC, sin zona). */
export function sumarDias(clave: string, dias: number): string {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Edad cumplida a hoy, a partir de una fecha de nacimiento. */
export function edad(nacimiento: string | Date | null | undefined): number | null {
  if (!nacimiento) return null;
  const n = new Date(nacimiento);
  if (Number.isNaN(n.getTime())) return null;
  const hoy = new Date();
  let anios = hoy.getUTCFullYear() - n.getUTCFullYear();
  const m = hoy.getUTCMonth() - n.getUTCMonth();
  if (m < 0 || (m === 0 && hoy.getUTCDate() < n.getUTCDate())) anios -= 1;
  return anios >= 0 && anios < 130 ? anios : null;
}

/** «2026-03-14» + «08:30» de la clínica → instante (con el cambio de hora resuelto). */
export { parseZonedDateTime as aInstante } from '@/server/lib/datetime';

/** Día de la semana (0 = domingo) de una clave «AAAA-MM-DD». */
export function diaDeLaSemana(clave: string): number {
  return new Date(`${clave}T12:00:00Z`).getUTCDay();
}
