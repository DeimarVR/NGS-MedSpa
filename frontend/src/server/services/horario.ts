/**
 * Horario por defecto, el de basico.html: martes a viernes de 10:00 a 19:00 y
 * sábado de 9:00 a 16:00. Domingo y lunes, cerrado. Se usa mientras la tabla
 * `business_hours` esté vacía (y el seed la llena con esto mismo).
 */
export type Horas = { open: string; close: string; breakStart?: string; breakEnd?: string };

export const HORARIO_POR_DEFECTO: Array<Horas | null> = [
  null,
  null,
  { open: '10:00', close: '19:00' },
  { open: '10:00', close: '19:00' },
  { open: '10:00', close: '19:00' },
  { open: '10:00', close: '19:00' },
  { open: '09:00', close: '16:00' },
];
