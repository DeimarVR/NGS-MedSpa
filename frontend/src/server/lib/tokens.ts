import { randomBytes } from 'node:crypto';

/**
 * Token de los enlaces que recibe la clienta (seguimiento y gestión de cita).
 * El enlace ES la llave: 24 bytes del azar del sistema, imposibles de adivinar.
 * `cuid()` NO sirve para esto: está hecho para no chocar, no para ser secreto.
 */
export function tokenDeEnlace(): string {
  return randomBytes(24).toString('base64url');
}
