import { z } from 'zod';

/**
 * Dirección de una imagen guardada: ruta interna `/api/archivos/...` (lo que
 * produce la subida al bucket) o una URL https completa.
 */
export const urlImagen = z
  .string()
  .trim()
  .min(1)
  .refine((valor) => valor.startsWith('/api/archivos/') || /^https:\/\/.+/i.test(valor), 'v.imagen');

/** Firma dibujada en pantalla: PNG en data URL y con tope de tamaño. */
export const firmaPng = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'v.firmaPng')
  .max(600_000, 'v.firmaPesada');
