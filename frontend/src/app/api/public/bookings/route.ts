import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as appointments from '@/server/modules/appointments/appointments.service';
import { idiomaDe } from '@/server/i18n';
import { LIMITES, body, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bookingSchema = z.object({
  serviceId: z.string().min(1, 'v.elegirTratamiento'),
  contactName: z.string().trim().min(3, 'v.nombreCompleto').max(120),
  contactPhone: z.string().trim().min(7, 'v.telefonoObligatorio').max(30),
  contactEmail: z.email('v.correo').optional().or(z.literal('')),
  message: z.string().trim().max(600).optional(),
  startsAt: z.iso.datetime({ message: 'v.elegirHorario' }),
  /** Trampa para robots. */
  empresa: z.string().optional(),
  acceptsPolicy: z.literal(true, { message: 'v.aceptarPolitica' }),
});

/** Reserva en línea desde la web. Nace PENDIENTE: la clínica la confirma. */
export const POST = route(async (req) => {
  limitar(req, 'reserva', LIMITES.formulario);
  const datos = await body(req, bookingSchema);

  if (datos.empresa) return NextResponse.json({ ok: true }, { status: 201 });

  const result = await appointments.createBooking({
    serviceId: datos.serviceId,
    contactName: datos.contactName,
    contactPhone: datos.contactPhone,
    contactEmail: datos.contactEmail || undefined,
    message: datos.message,
    startsAt: new Date(datos.startsAt),
    locale: idiomaDe(req),
  });

  return NextResponse.json(
    {
      appointment: {
        id: result.appointment.id,
        startsAt: result.appointment.startsAt,
        endsAt: result.appointment.endsAt,
        status: result.appointment.status,
      },
      manageToken: result.appointment.manageToken,
      manageUrl: result.manageUrl,
    },
    { status: 201 },
  );
});
