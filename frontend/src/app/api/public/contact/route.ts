import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { normalizePhone } from '@/server/lib/phone';
import { enumDeLocale } from '@/lib/idiomas';
import { LIMITES, body, limitar, route, t } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'v.escribeTuNombre').max(120),
  phone: z.string().trim().min(7, 'v.telefonoObligatorio').max(30),
  email: z.email('v.correo').max(160).optional().or(z.literal('')),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(5, 'v.cuentanosMas').max(2000),
  locale: z.string().max(5).optional(),
  /** Trampa para robots: una persona no la llena. */
  empresa: z.string().optional(),
});

/** Formulario «Escríbenos» de la landing. Llega a la bandeja de Mensajes del panel. */
export const POST = route(async (req) => {
  limitar(req, 'contacto', LIMITES.formulario);
  const datos = await body(req, contactSchema);

  // Un robot llenó la trampa: se le contesta igual, para que no insista.
  if (datos.empresa) return NextResponse.json({ message: t(req)('api.contacto.recibido') }, { status: 201 });

  await prisma.contactMessage.create({
    data: {
      name: datos.name,
      phone: normalizePhone(datos.phone),
      email: datos.email?.toLowerCase() || null,
      subject: datos.subject || null,
      message: datos.message,
      locale: enumDeLocale(datos.locale),
    },
  });

  return NextResponse.json({ message: t(req)('api.contacto.recibido') }, { status: 201 });
});
