import type { FaceView } from '@/lib/types';

/**
 * Zonas del rostro. Se guarda la CLAVE (`entrecejo`): el nombre se traduce al
 * mostrarlo, así un mapa hecho en español se lee en inglés sin tocarlo.
 */
export const ZONAS = [
  'frente',
  'entrecejo',
  'cejas',
  'patasDeGallo',
  'sien',
  'ojeras',
  'pomulos',
  'nariz',
  'surcoNasogeniano',
  'labios',
  'comisuras',
  'menton',
  'mandibula',
  'masetero',
  'papada',
  'cuello',
  'otra',
] as const;
export type Zona = (typeof ZONAS)[number];

export function esZona(valor: string): valor is Zona {
  return (ZONAS as readonly string[]).includes(valor);
}

/** Medidas del dibujo (viewBox). Las posiciones se guardan en % de esto. */
export const ANCHO = 300;
export const ALTO = 380;

type Ancla = [Zona, number, number];

const FRENTE: Ancla[] = [
  ['frente', 150, 92],
  ['entrecejo', 150, 140],
  ['cejas', 104, 132],
  ['cejas', 196, 132],
  ['patasDeGallo', 88, 165],
  ['patasDeGallo', 212, 165],
  ['sien', 80, 118],
  ['sien', 220, 118],
  ['ojeras', 118, 180],
  ['ojeras', 182, 180],
  ['pomulos', 100, 202],
  ['pomulos', 200, 202],
  ['nariz', 150, 198],
  ['surcoNasogeniano', 126, 234],
  ['surcoNasogeniano', 174, 234],
  ['labios', 150, 255],
  ['comisuras', 122, 270],
  ['comisuras', 178, 270],
  ['menton', 150, 302],
  ['mandibula', 96, 272],
  ['mandibula', 204, 272],
  ['masetero', 82, 236],
  ['masetero', 218, 236],
  ['cuello', 150, 352],
];

/** Perfil con la nariz hacia la izquierda (el izquierdo); el derecho es su espejo. */
const PERFIL: Ancla[] = [
  ['frente', 116, 100],
  ['sien', 158, 138],
  ['cejas', 116, 150],
  ['patasDeGallo', 140, 172],
  ['ojeras', 116, 184],
  ['pomulos', 142, 204],
  ['nariz', 82, 205],
  ['surcoNasogeniano', 108, 232],
  ['labios', 92, 256],
  ['comisuras', 108, 266],
  ['menton', 104, 298],
  ['mandibula', 160, 290],
  ['masetero', 178, 240],
  ['papada', 140, 318],
  ['cuello', 165, 345],
];

/** La zona más cercana a donde se tocó (en coordenadas del dibujo). */
export function zonaCercana(vista: FaceView, x: number, y: number): Zona {
  const anclas = vista === 'FRENTE' ? FRENTE : PERFIL.map(([z, ax, ay]): Ancla => [z, vista === 'PERFIL_DER' ? ANCHO - ax : ax, ay]);
  let mejor: Zona = 'otra';
  let distancia = Infinity;
  for (const [zona, ax, ay] of anclas) {
    const d = (ax - x) ** 2 + (ay - y) ** 2;
    if (d < distancia) {
      distancia = d;
      mejor = zona;
    }
  }
  return distancia > 55 ** 2 ? 'otra' : mejor;
}
