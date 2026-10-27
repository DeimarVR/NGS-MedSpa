import { prisma } from './lib/prisma';

/**
 * Ajustes que se cambian desde el panel sin desplegar.
 *
 * La lista es CERRADA: `settings` es una tabla clave/valor y, sin lista
 * blanca, cualquier ruta podría inventarse claves que después nadie sabe qué
 * significan. Cada ajuste trae su valor por defecto (los datos de ejemplo de
 * basico.html hasta que la clínica entregue los suyos).
 */
export const AJUSTES = {
  /** Teléfono público de la clínica, como se muestra. */
  telefono: { clave: 'clinica.telefono', defecto: '(214) 555-0100' },
  /** Usuario de Instagram, sin @. */
  instagram: { clave: 'clinica.instagram', defecto: 'ngsmedspa' },
  /** Enlace de Google Maps. Vacío: se arma con la dirección. */
  mapaUrl: { clave: 'clinica.mapaUrl', defecto: '' },
  /** Franja de «vista previa · datos de ejemplo» arriba de la landing. */
  avisoDemo: { clave: 'sitio.avisoDemo', defecto: '1' },
  /** Foto del equipo o la clínica en «Nuestra esencia» (ruta /api/archivos/sitio/...). */
  fotoEsencia: { clave: 'sitio.fotoEsencia', defecto: '' },
  /** Cuántas clientas se atienden a la vez (una inyectora: 1). */
  cupos: { clave: 'agenda.cupos', defecto: '1' },
  /** Impuesto por defecto de los recibos, en puntos básicos (825 = 8,25 %). Pendiente de confirmar. */
  impuestoBps: { clave: 'recibos.impuestoBps', defecto: '0' },
  /** Nota al pie de los recibos. */
  notaRecibo: { clave: 'recibos.nota', defecto: '' },
} as const;

export type NombreAjuste = keyof typeof AJUSTES;

export async function leerAjustes<N extends NombreAjuste>(nombres: readonly N[]): Promise<Record<N, string>> {
  const filas = await prisma.setting.findMany({
    where: { key: { in: nombres.map((n) => AJUSTES[n].clave) } },
  });
  const porClave = new Map(filas.map((f) => [f.key, f.value]));
  const salida = {} as Record<N, string>;
  for (const nombre of nombres) {
    salida[nombre] = porClave.get(AJUSTES[nombre].clave) ?? AJUSTES[nombre].defecto;
  }
  return salida;
}

export async function leerAjuste(nombre: NombreAjuste): Promise<string> {
  return (await leerAjustes([nombre]))[nombre];
}

export async function guardarAjuste(nombre: NombreAjuste, valor: string): Promise<void> {
  const clave = AJUSTES[nombre].clave;
  await prisma.setting.upsert({ where: { key: clave }, create: { key: clave, value: valor }, update: { value: valor } });
}

export async function leerTodos(): Promise<Record<NombreAjuste, string>> {
  return leerAjustes(Object.keys(AJUSTES) as NombreAjuste[]);
}
