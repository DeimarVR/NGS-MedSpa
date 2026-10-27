import * as appointments from '@/server/modules/appointments/appointments.service';
import { idiomaDe } from '@/server/i18n';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ manageToken: string }>(async (req, { params }) =>
  appointments.getByManageToken(params.manageToken, idiomaDe(req)),
);
