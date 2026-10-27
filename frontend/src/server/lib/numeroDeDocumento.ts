/**
 * ¿Lo que escribieron puede ser el número de un recibo?
 *
 * Un teléfono también son solo dígitos: sin el tope, buscar «2145550100»
 * hacía fallar Postgres con «value out of range for type integer».
 */
const TOPE_ENTERO = 2_147_483_647;

export function numeroDeDocumento(texto: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number.parseInt(texto, 10);
  return Number.isSafeInteger(numero) && numero > 0 && numero <= TOPE_ENTERO ? numero : null;
}

export function condicionPorNumero(texto: string): Array<{ number: number }> {
  const numero = numeroDeDocumento(texto);
  return numero === null ? [] : [{ number: numero }];
}
