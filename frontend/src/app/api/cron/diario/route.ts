import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { runDailyJobs } from '@/server/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function mismoSecreto(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * La invoca Vercel Cron con `Authorization: Bearer <CRON_SECRET>`. Sin la
 * variable definida la ruta responde 401 y no hace nada: mejor que no corra a
 * dejar un endpoint abierto.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !mismoSecreto(req.headers.get('authorization') ?? '', `Bearer ${secreto}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, resultados: await runDailyJobs() });
}
