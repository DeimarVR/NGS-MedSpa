import { HttpError } from './httpError';

/**
 * Teléfonos de EE. UU. (+1, 10 dígitos).
 *
 * Se guardan con el 1 delante y sin «+»: `12145550100`. Así sirven tal cual
 * para wa.me, para `tel:` y para `sms:` el día que se decida avisar por ahí.
 *
 * Acepta lo que la gente escribe: «(214) 555-0100», «214.555.0100»,
 * «+1 214 555 0100», «2145550100». Un número de otro país (la clínica atiende
 * clientas de fuera) se acepta si viene con «+» y su indicativo.
 */
export function normalizePhone(input: string): string {
  const conMas = input.trim().startsWith('+');
  const digitos = input.replace(/\D/g, '');

  if (digitos.length === 0) throw HttpError.badRequest('api.telefono.vacio');

  // 10 dígitos: número de EE. UU. sin el 1.
  if (digitos.length === 10 && !conMas) return `1${digitos}`;

  // 11 dígitos que empiezan por 1: ya trae el indicativo.
  if (digitos.length === 11 && digitos.startsWith('1')) return digitos;

  // Internacional, escrito con «+».
  if (conMas && digitos.length >= 8 && digitos.length <= 15) return digitos;

  throw HttpError.badRequest('api.telefono.invalido');
}

/** `12145550100` → `(214) 555-0100`; internacional → `+44 7700 900123`. */
export function formatPhoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, '');
  const local = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : null;
  if (local) return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  return `+${d}`;
}
