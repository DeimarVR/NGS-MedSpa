import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/httpError';

/**
 * Que la misma CREACIÓN no se haga dos veces.
 *
 * Pasaba en Dermocapilar con las fichas: la conexión se cortaba a mitad del guardado, el
 * servidor terminaba igual, la pantalla decía que no se pudo, y al volver a
 * darle a guardar salía una segunda ficha. El formulario manda una clave por
 * intento; la primera petición la reserva y, al terminar, apunta qué creó. Una
 * segunda con la misma clave recibe lo ya creado.
 *
 * Devuelve el id ya creado si la clave se usó, o null si esta petición es la
 * primera (y entonces le toca crear y llamar a `apuntarEnvio`).
 */
export async function reservarEnvio(tipo: string, clave: string | null | undefined): Promise<string | null> {
  const limpia = clave?.trim();
  if (!limpia) return null;
  const key = `envio:${tipo}:${limpia}`;
  try {
    await prisma.setting.create({ data: { key, value: '' } });
    return null;
  } catch {
    const previa = await prisma.setting.findUnique({ where: { key } });
    if (previa?.value) return previa.value;
    /*
     * Una reserva vacía de hace rato es de una petición que murió a medias
     * (se cortó la función antes de crear nada): no puede bloquear para
     * siempre el reintento.
     */
    if (previa && Date.now() - previa.updatedAt.getTime() > ABANDONADA_MS) {
      const { count } = await prisma.setting.updateMany({
        where: { key, value: '', updatedAt: previa.updatedAt },
        data: { value: '' },
      });
      if (count === 1) return null;
    }
    throw HttpError.conflict('api.envio.enCurso');
  }
}

/** Más que lo que puede durar una petición (`maxDuration` de 60 s). */
const ABANDONADA_MS = 90_000;

/** La creación falló: la clave queda libre para reintentar con ella. */
export async function soltarEnvio(tipo: string, clave: string | null | undefined): Promise<void> {
  const limpia = clave?.trim();
  if (!limpia) return;
  await prisma.setting.deleteMany({ where: { key: `envio:${tipo}:${limpia}`, value: '' } }).catch(() => {});
}

/**
 * Crea con la clave reservada: si ya se creó con ella devuelve ese id y
 * `repetida`; si la creación falla, suelta la clave.
 */
export async function crearUnaVez<T extends { id: string }>(
  tipo: string,
  clave: string | null | undefined,
  crear: () => Promise<T>,
): Promise<{ creada: T; repetida: false } | { idPrevio: string; repetida: true }> {
  const previo = await reservarEnvio(tipo, clave);
  if (previo) return { idPrevio: previo, repetida: true };
  let creada: T;
  try {
    creada = await crear();
  } catch (fallo) {
    await soltarEnvio(tipo, clave);
    throw fallo;
  }
  await apuntarEnvio(tipo, clave, creada.id);
  return { creada, repetida: false };
}

export async function apuntarEnvio(tipo: string, clave: string | null | undefined, id: string): Promise<void> {
  const limpia = clave?.trim();
  if (!limpia) return;
  await prisma.setting
    .update({ where: { key: `envio:${tipo}:${limpia}` }, data: { value: id } })
    .catch(() => {});
  await prisma.setting
    .deleteMany({
      where: { key: { startsWith: `envio:${tipo}:` }, updatedAt: { lt: new Date(Date.now() - 2 * 86_400_000) } },
    })
    .catch(() => {});
}

/**
 * Las filas que dicen ser «de antes» tienen que ser de ESTE registro, y cada
 * una una sola vez. Un id ajeno modificaba la fila de otro paciente.
 */
export function comprobarFilasPropias(
  propias: Iterable<string>,
  llegan: Array<string | null | undefined>,
): Set<string> {
  const deAqui = new Set(propias);
  const vistos = new Set<string>();
  for (const id of llegan) {
    if (!id) continue;
    if (!deAqui.has(id) || vistos.has(id)) {
      throw HttpError.conflict('api.envio.filaAjena');
    }
    vistos.add(id);
  }
  return vistos;
}

/** Si alguien guardó después de que se abrió el formulario, no se pisa. */
export function comprobarVersion(enviada: string | null | undefined, actual: Date): void {
  if (enviada && new Date(enviada).getTime() !== actual.getTime()) {
    throw HttpError.conflict(MENSAJE_GUARDADO_POR_OTRO);
  }
}

export const MENSAJE_GUARDADO_POR_OTRO = 'api.envio.guardadoPorOtro';

/**
 * Dentro de la transacción: si el registro ya no tiene el `updatedAt` que se
 * leyó, otro guardado se coló entre medio (dos pestañas, o un doble clic que
 * mandó dos peticiones a la vez). Comprobarlo FUERA de la transacción no
 * alcanza: las dos peticiones leían la misma versión y las dos pasaban.
 * El `updateMany` bloquea la fila, así que la segunda espera a la primera y
 * luego ya no encuentra la versión.
 */
export function versionTomada(count: number): void {
  if (count !== 1) throw HttpError.conflict(MENSAJE_GUARDADO_POR_OTRO);
}

/** La clienta de un documento clínico no se cambia al editarlo. */
export function comprobarMismoPaciente(enviado: string | null | undefined, actual: string): void {
  if (enviado && enviado !== actual) {
    throw HttpError.unprocessable('api.envio.mismaClienta');
  }
}
