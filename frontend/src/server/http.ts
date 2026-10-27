import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { Prisma, type Role } from '@/generated/prisma/client';
import { env, isProd } from './config/env';
import { HttpError } from './lib/httpError';
import { createLogger } from './lib/logger';
import { idiomaDe, traductor, type Traductor } from './i18n';

const log = createLogger('api');

/* -------------------------------------------------------------------------
 * Sesión
 * ---------------------------------------------------------------------- */

export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
  fullName: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Exige una sesión válida y devuelve quién es. Lanza en vez de devolver null:
 * una ruta que se olvide de comprobar falla cerrada, no abierta.
 */
export function requireAuth(req: NextRequest): AuthPayload {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw HttpError.unauthorized('api.sesion.faltaToken');

  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    throw HttpError.unauthorized('api.sesion.vencida');
  }
}

/**
 * Sesión leída del encabezado O de la cookie, SOLO para servir archivos: las
 * etiquetas `<img>` no mandan encabezados. Si una cookie bastara para escribir,
 * cualquier página ajena podría modificar datos con la sesión abierta.
 */
export function sesionParaArchivos(req: NextRequest): AuthPayload | null {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : req.cookies.get('token')?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

/** Exige sesión y que el rol esté en la lista. */
export function requireRole(req: NextRequest, ...roles: Role[]): AuthPayload {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) throw HttpError.forbidden('api.sesion.rolSinPermiso');
  return user;
}

/* -------------------------------------------------------------------------
 * Entrada
 * ---------------------------------------------------------------------- */

/** Cuerpo JSON validado. JSON roto: 400; que no cumple: 422. */
export async function body<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    throw HttpError.badRequest('api.general.jsonInvalido');
  }
  return schema.parse(crudo) as z.infer<S>;
}

/** Parámetros de consulta validados. */
export function query<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  const objeto = Object.fromEntries(req.nextUrl.searchParams.entries());
  return schema.parse(objeto) as z.infer<S>;
}

/**
 * Un sí/no de la dirección (`?handled=false`). NO `z.coerce.boolean()`:
 * `Boolean('false')` es `true`.
 */
export const booleanoDeConsulta = z.enum(['true', 'false']).transform((texto) => texto === 'true');

/* -------------------------------------------------------------------------
 * Mensajes de validación, traducidos y con el campo
 * ---------------------------------------------------------------------- */

/** Listas cuyos elementos se nombran con su número («Línea 3»). */
const LISTAS = new Set(['entries', 'items', 'photos', 'fotos', 'puntos']);

function dondeEsta(path: PropertyKey[], t: Traductor): string {
  const partes: string[] = [];
  for (let i = 0; i < path.length; i += 1) {
    const tramo = path[i];
    const siguiente = path[i + 1];
    if (typeof tramo === 'string' && typeof siguiente === 'number' && LISTAS.has(tramo)) {
      partes.push(t(`campos.lista.${tramo}`, { n: siguiente + 1 }));
      i += 1;
    } else if (typeof tramo === 'string') {
      const clave = `campos.${tramo}`;
      const nombre = t(clave);
      partes.push(nombre === clave ? tramo : nombre);
    }
  }
  return partes.join(' · ');
}

export function mensajeDeValidacion(issue: z.core.$ZodIssue, t: Traductor): string {
  const donde = dondeEsta(issue.path, t);
  // Los mensajes propios son claves que empiezan por «v.».
  const propio = issue.message.startsWith('v.');
  let que: string;
  if (propio) {
    que = t(`validacion.${issue.message.slice(2)}`);
  } else if (issue.code === 'too_big') {
    que = t(issue.origin === 'string' ? 'validacion.maxCaracteres' : issue.origin === 'array' ? 'validacion.maxElementos' : 'validacion.maxValor', {
      n: Number(issue.maximum),
    });
  } else if (issue.code === 'too_small') {
    que =
      issue.origin === 'string'
        ? Number(issue.minimum) <= 1
          ? t('validacion.vacio')
          : t('validacion.minCaracteres', { n: Number(issue.minimum) })
        : t(issue.origin === 'array' ? 'validacion.minElementos' : 'validacion.minValor', { n: Number(issue.minimum) });
  } else if (issue.code === 'invalid_type') {
    que = issue.input === undefined || issue.input === null ? t('validacion.falta') : t('validacion.formato');
  } else if (issue.code === 'invalid_value') {
    que = t('validacion.noPermitido');
  } else if (issue.code === 'invalid_format') {
    que = issue.format === 'email' ? t('validacion.correo') : t('validacion.formato');
  } else {
    que = t('validacion.noValido');
  }
  if (!donde) return que.charAt(0).toUpperCase() + que.slice(1);
  return propio ? que : `${donde}: ${que}`;
}

/* -------------------------------------------------------------------------
 * Salida
 * ---------------------------------------------------------------------- */

/** Código corto para buscar UN fallo en el log; se lee en voz alta sin confusión. */
function nuevoIncidente(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i += 1) codigo += letras[Math.floor(Math.random() * letras.length)];
  return codigo;
}

function metaEnCorto(meta: unknown): string | undefined {
  if (meta === undefined || meta === null) return undefined;
  try {
    return JSON.stringify(meta).slice(0, 300);
  } catch {
    return String(meta).slice(0, 300);
  }
}

/**
 * Lo que se dice cuando falló Prisma. El CÓDIGO sí viaja en la respuesta (dice
 * si falta una migración o si la base está saturada); el mensaje crudo NUNCA:
 * puede llevar un teléfono o un nombre, y la pantalla es de un equipo
 * compartido. Al log sí va entero.
 */
function respuestaDePrisma(err: unknown): { estado: number; codigo: string; clave: string; codigoBase?: string } | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2021' || err.code === 'P2022') {
      return { estado: 500, codigo: 'database_error', codigoBase: err.code, clave: 'api.base.faltaMigracion' };
    }
    if (err.code === 'P2024') {
      return { estado: 503, codigo: 'base_saturada', codigoBase: err.code, clave: 'api.base.saturada' };
    }
    return { estado: 500, codigo: 'database_error', codigoBase: err.code, clave: 'api.base.fallo' };
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { estado: 503, codigo: 'base_no_disponible', codigoBase: err.errorCode ?? undefined, clave: 'api.base.noDisponible' };
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return { estado: 500, codigo: 'database_error', clave: 'api.base.consultaMal' };
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError || err instanceof Prisma.PrismaClientRustPanicError) {
    return { estado: 500, codigo: 'database_error', clave: 'api.base.desconocido' };
  }
  return null;
}

/**
 * Traduce cualquier error a una respuesta, en el idioma de la petición.
 * NINGÚN error sale sin algo con lo que buscarlo en el log.
 */
export function fail(err: unknown, req?: NextRequest | Request): NextResponse {
  const t = traductor(req ? idiomaDe(req) : 'en');
  const metodo = req?.method;

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'validation_error',
        message: t('api.general.datosInvalidos'),
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: mensajeDeValidacion(issue, t),
        })),
      },
      { status: 422 },
    );
  }

  if (err instanceof HttpError) {
    return NextResponse.json(
      {
        error: err.code,
        message: t(err.message, err.valores),
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.status },
    );
  }

  // Los tres códigos que son estado de los datos, no averías.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'conflict', message: t('api.base.duplicado') }, { status: 409 });
    }
    if (err.code === 'P2025') {
      return NextResponse.json(
        {
          error: 'not_found',
          message: metodo && metodo !== 'GET' && metodo !== 'DELETE' ? t('api.base.yaNoExisteAlGuardar') : t('api.general.noEncontrado'),
        },
        { status: 404 },
      );
    }
    if (err.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'conflict',
          message: metodo === 'DELETE' ? t('api.base.tieneRelacionados') : t('api.base.elegidoYaNoExiste'),
        },
        { status: metodo === 'DELETE' ? 409 : 422 },
      );
    }
  }

  const incidente = nuevoIncidente();
  const dePrisma = respuestaDePrisma(err);

  log.error(`Error no controlado [${incidente}]`, {
    incidente,
    tipo: err instanceof Error ? err.constructor.name : typeof err,
    codigoPrisma: dePrisma?.codigoBase ?? null,
    mensaje: err instanceof Error ? err.message.slice(0, 600) : String(err).slice(0, 600),
    meta: err instanceof Prisma.PrismaClientKnownRequestError ? metaEnCorto(err.meta) : undefined,
    causa: err instanceof Error && err.cause !== undefined ? String(err.cause).slice(0, 300) : undefined,
    pila: err instanceof Error ? err.stack?.split('\n').slice(1, 6).join(' | ') : undefined,
  });

  // El código va DENTRO del mensaje: la pantalla solo pinta `message`.
  const comoAvisar = ' ' + t('api.general.codigoIncidente', { codigo: incidente });

  if (dePrisma) {
    return NextResponse.json(
      {
        error: dePrisma.codigo,
        message: t(dePrisma.clave, { codigo: dePrisma.codigoBase ?? '—' }) + comoAvisar,
        incidente,
        ...(dePrisma.codigoBase ? { codigoBase: dePrisma.codigoBase } : {}),
        ...(isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
      },
      { status: dePrisma.estado },
    );
  }

  return NextResponse.json(
    {
      error: 'internal_error',
      message: t('api.general.inesperado') + comoAvisar,
      incidente,
      ...(isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
    },
    { status: 500 },
  );
}

/**
 * Envuelve un manejador de ruta. En Next 16 los `params` llegan como promesa;
 * aquí se resuelven antes de llamar, para que cada ruta los lea directo.
 */
export function route<P extends Record<string, string | string[]> = Record<string, string>>(
  fn: (req: NextRequest, ctx: { params: P }) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const salida = await fn(req, { params });
      if (salida instanceof NextResponse || salida instanceof Response) return salida as NextResponse;
      return NextResponse.json(salida ?? {});
    } catch (err) {
      return fail(err, req);
    }
  };
}

/** El traductor de la petición, para las rutas que arman textos (PDF, Excel). */
export function t(req: NextRequest): Traductor {
  return traductor(idiomaDe(req));
}

/* -------------------------------------------------------------------------
 * Límite de peticiones (best effort: vive en la memoria de cada instancia)
 * ---------------------------------------------------------------------- */

const contadores = new Map<string, { hasta: number; usos: number }>();

export function limitar(
  req: NextRequest,
  clave: string,
  { usos, ventanaMs, mensaje }: { usos: number; ventanaMs: number; mensaje: string },
): void {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'desconocida';
  const id = `${clave}:${ip}`;
  const ahora = Date.now();

  const actual = contadores.get(id);
  if (!actual || actual.hasta < ahora) {
    contadores.set(id, { hasta: ahora + ventanaMs, usos: 1 });
  } else {
    actual.usos += 1;
    if (actual.usos > usos) throw new HttpError(429, mensaje, 'rate_limited');
  }

  if (contadores.size > 5_000) {
    for (const [k, v] of contadores) if (v.hasta < ahora) contadores.delete(k);
  }
}

export const LIMITES = {
  login: { usos: 10, ventanaMs: 15 * 60_000, mensaje: 'api.limite.login' },
  formulario: { usos: 8, ventanaMs: 10 * 60_000, mensaje: 'api.limite.formulario' },
} as const;
