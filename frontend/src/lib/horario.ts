/**
 * Horario de atención para mostrar: agrupa los días seguidos con la misma
 * franja («Martes a viernes · 10:00 AM – 7:00 PM») y formatea en el idioma.
 */
export type DiaDeHorario = { dia: number; abre: string; cierra: string } | { dia: number; cerrado: true };

export interface Tramo {
  desde: number;
  hasta: number;
  abre: string;
  cierra: string;
}

/** La semana empieza el lunes, como se lee un horario. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

export function agruparHorario(horario: DiaDeHorario[]): Tramo[] {
  const tramos: Tramo[] = [];
  for (const dia of ORDEN) {
    const h = horario.find((x) => x.dia === dia);
    if (!h || 'cerrado' in h) continue;
    const ultimo = tramos[tramos.length - 1];
    const anterior = ORDEN[ORDEN.indexOf(dia) - 1];
    if (ultimo && ultimo.hasta === anterior && ultimo.abre === h.abre && ultimo.cierra === h.cierra) {
      ultimo.hasta = dia;
    } else {
      tramos.push({ desde: dia, hasta: dia, abre: h.abre, cierra: h.cierra });
    }
  }
  return tramos;
}

/** "19:00" → "7:00 PM" / "19 h 00" / "19:00", según el idioma. */
export function horaLocal(hhmm: string, intl: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 0, 1, h, m)),
  );
}

/** 0 → «domingo» / «Sunday», en el idioma (con la mayúscula que use ese idioma). */
export function nombreDia(dia: number, intl: string, estilo: 'long' | 'short' = 'long'): string {
  // El 1 de enero de 2023 fue domingo.
  return new Intl.DateTimeFormat(intl, { weekday: estilo, timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + dia)));
}

/** Primera letra en mayúscula («martes a viernes» → «Martes a viernes»). */
export function capitalizar(texto: string, intl: string): string {
  return texto.charAt(0).toLocaleUpperCase(intl) + texto.slice(1);
}
