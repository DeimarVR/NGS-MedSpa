import { NextResponse } from 'next/server';
import { getPatientProgress } from '@/server/modules/public/tracking.service';
import { idiomaDe } from '@/server/i18n';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ publicToken: string }>(async (req, { params }) => {
  const progreso = await getPatientProgress(params.publicToken, idiomaDe(req));
  return NextResponse.json(progreso, { headers: { 'Cache-Control': 'no-store, private' } });
});
