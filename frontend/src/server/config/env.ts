import { z } from 'zod';

/**
 * Variables de entorno, validadas con zod.
 *
 * Son SOLO las de la sección 3 del contexto. Si un día se decide mandar avisos
 * por WhatsApp, SMS o correo, o cobrar depósitos en línea, se agregan aquí las
 * de ese servicio en ese momento, no antes.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  /** Dirección pública del sitio, para los enlaces que van en los PDF. */
  PUBLIC_WEB_URL: z.url().default('http://localhost:3000'),

  CLINIC_NAME: z.string().default('NGS MedSpa'),
  CLINIC_ADDRESS: z.string().default('Dallas – Fort Worth, TX'),
  CLINIC_TIMEZONE: z.string().default('America/Chicago'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  CRON_SECRET: z.string().optional(),
});

type Env = z.infer<typeof schema>;

let comprobadas: Env | null = null;

/**
 * Se valida la PRIMERA vez que alguien pide una variable, no al importar: al
 * compilar, Next importa cada ruta para inspeccionarla y no debe exigir los
 * secretos de producción para construir.
 */
function cargar(): Env {
  if (comprobadas) return comprobadas;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${detalle}`);
  }

  comprobadas = parsed.data;
  return comprobadas;
}

export const env = new Proxy({} as Env, {
  get: (_objetivo, propiedad: string) => cargar()[propiedad as keyof Env],
  has: (_objetivo, propiedad: string) => propiedad in cargar(),
  ownKeys: () => Reflect.ownKeys(cargar()),
  getOwnPropertyDescriptor: (_objetivo, propiedad: string) => ({
    value: cargar()[propiedad as keyof Env],
    enumerable: true,
    configurable: true,
  }),
});

/** Se lee de `process.env` directo para no disparar la validación al importar. */
export const isProd = process.env.NODE_ENV === 'production';
