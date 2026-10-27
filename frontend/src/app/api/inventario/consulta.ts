import { z } from 'zod';
import { ProductKind } from '@/generated/prisma/client';
import { booleanoDeConsulta } from '@/server/http';

export const consultaInventarioSchema = z.object({
  q: z.string().trim().min(1).optional(),
  kind: z.enum(ProductKind).optional(),
  soloBajos: booleanoDeConsulta.optional(),
  soloPorVencer: booleanoDeConsulta.optional(),
  incluirArchivados: booleanoDeConsulta.optional(),
  soloArchivados: booleanoDeConsulta.optional(),
  orden: z.enum(['nombre', 'vencimiento']).optional(),
});
