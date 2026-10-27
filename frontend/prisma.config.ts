import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuración de Prisma 7.
 *
 * La URL de la base ya no va en `schema.prisma`: se lee aquí. Se deja opcional
 * para que `prisma generate` (que corre al instalar) funcione sin `.env`; los
 * comandos que sí tocan la base la exigen por su cuenta.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
