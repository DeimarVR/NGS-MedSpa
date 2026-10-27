import { z } from 'zod';
import * as service from '@/server/modules/appointments/appointments.service';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const rescheduleSchema = z.object({
  startsAt: z.iso.datetime(),
  /** Se movió hablando con la clienta: queda confirmada. */
  quedaConfirmada: z.boolean().default(true),
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const { startsAt, quedaConfirmada } = await body(req, rescheduleSchema);
  return service.reschedule(params.id, new Date(startsAt), { desdeElPanel: true, quedaConfirmada });
});
