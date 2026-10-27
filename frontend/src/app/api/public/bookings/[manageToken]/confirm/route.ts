import * as appointments from '@/server/modules/appointments/appointments.service';
import { LIMITES, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ manageToken: string }>(async (req, { params }) => {
  limitar(req, 'confirmacion', LIMITES.formulario);
  const appointment = await appointments.confirmByToken(params.manageToken);
  return { status: appointment.status };
});
