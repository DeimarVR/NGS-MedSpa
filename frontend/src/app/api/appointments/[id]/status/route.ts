import { z } from 'zod';
import { AppointmentStatus } from '@/generated/prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, route } from '@/server/http';
import { assertSlotIsFree } from '@/server/services/availability';
import { cancelByToken } from '@/server/modules/appointments/appointments.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statusSchema = z.object({ status: z.enum(AppointmentStatus) });

const VIVAS: AppointmentStatus[] = [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA];

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  requireAuth(req);
  const { status } = await body(req, statusSchema);

  const cita = await prisma.appointment.findUnique({
    where: { id: params.id },
    select: { status: true, startsAt: true, endsAt: true, manageToken: true },
  });
  if (!cita) throw HttpError.notFound('api.citas.noEncontrada');

  // Revivir una cancelada: el cupo pudo tomarlo otra persona entretanto.
  if (!VIVAS.includes(cita.status) && VIVAS.includes(status)) {
    await assertSlotIsFree(cita.startsAt, cita.endsAt, { desdeElPanel: true, excluirCita: params.id });
  }

  // Cancelar pasa por la función de siempre, que sella `cancelledAt`.
  if (status === AppointmentStatus.CANCELADA && VIVAS.includes(cita.status)) {
    return cancelByToken(cita.manageToken);
  }

  return prisma.appointment.update({
    where: { id: params.id },
    data: { status, ...(VIVAS.includes(status) ? { cancelledAt: null } : {}) },
  });
});
