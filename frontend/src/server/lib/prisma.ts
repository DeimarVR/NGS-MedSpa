import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env, isProd } from '../config/env';

/**
 * Cliente de Prisma 7, uno por instancia.
 *
 * Prisma 7 ya no trae motor propio: habla con Postgres a través del adaptador
 * `pg`. Se guarda en `globalThis` para que cada recarga en desarrollo no abra
 * una conexión más hasta agotar el tope de Railway.
 *
 * Se crea al primer uso (no al importar) para que compilar no exija la base.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function crear(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // En serverless cada instancia vive poco: con pocas conexiones basta.
    max: isProd ? 3 : 10,
  });
  return new PrismaClient({ adapter, log: ['error', 'warn'] });
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_objetivo, propiedad) {
    if (!globalParaPrisma.prisma) globalParaPrisma.prisma = crear();
    const valor = Reflect.get(globalParaPrisma.prisma, propiedad);
    return typeof valor === 'function' ? valor.bind(globalParaPrisma.prisma) : valor;
  },
});
