import { listServices } from '@/server/consultas';
import { idiomaDe } from '@/server/i18n';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tratamientos de la reserva en línea, en el idioma de quien pregunta. */
export const GET = route(async (req) => ({ items: await listServices(idiomaDe(req)) }));
