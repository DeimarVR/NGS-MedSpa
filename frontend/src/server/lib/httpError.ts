/** Valores que se interpolan en el mensaje traducido. */
export type Valores = Record<string, string | number>;

/**
 * Error con código HTTP.
 *
 * El `message` es una CLAVE de traducción (`api.citas.noEncontrada`), no un
 * texto: el panel está en cinco idiomas y quien traduce es `fail()` en
 * `http.ts`, con el idioma de la petición. Si la clave no existe en los
 * mensajes, se muestra tal cual.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly valores?: Valores;
  readonly details?: unknown;

  constructor(status: number, clave: string, code = 'error', valores?: Valores, details?: unknown) {
    super(clave);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.valores = valores;
    this.details = details;
  }

  static badRequest(clave = 'api.general.solicitudInvalida', valores?: Valores) {
    return new HttpError(400, clave, 'bad_request', valores);
  }

  static unauthorized(clave = 'api.general.noAutenticado') {
    return new HttpError(401, clave, 'unauthorized');
  }

  static forbidden(clave = 'api.general.sinPermiso') {
    return new HttpError(403, clave, 'forbidden');
  }

  static notFound(clave = 'api.general.noEncontrado', valores?: Valores) {
    return new HttpError(404, clave, 'not_found', valores);
  }

  static conflict(clave = 'api.general.conflicto', valores?: Valores) {
    return new HttpError(409, clave, 'conflict', valores);
  }

  static unprocessable(clave: string, valores?: Valores) {
    return new HttpError(422, clave, 'unprocessable', valores);
  }

  static serviceUnavailable(clave = 'api.general.noDisponible', valores?: Valores) {
    return new HttpError(503, clave, 'service_unavailable', valores);
  }
}
