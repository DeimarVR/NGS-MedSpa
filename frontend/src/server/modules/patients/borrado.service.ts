import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import type { Traductor } from '../../i18n';

/**
 * Borrar una clienta solo se puede si no tiene NADA: un historial clínico no
 * se borra de lado. Con algo dentro se archiva (queda inactiva y no estorba).
 */
export interface LoQueTiene {
  citas: number;
  mapas: number;
  fichasFaciales: number;
  recibos: number;
  fotos: number;
  planes: number;
  consentimientos: number;
  movimientos: number;
}

export interface EstadoDeBorrado {
  id: string;
  nombre: string;
  activo: boolean;
  tiene: LoQueTiene;
  sePuedeBorrar: boolean;
}

type Cliente = Prisma.TransactionClient;

async function contar(cliente: Cliente, id: string): Promise<EstadoDeBorrado> {
  const clienta = await cliente.patient.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      active: true,
      _count: {
        select: {
          appointments: true,
          records: true,
          facialRecords: true,
          invoices: true,
          photoRecords: true,
          plans: true,
          signedConsents: true,
          stockMoves: true,
        },
      },
    },
  });
  if (!clienta) throw HttpError.notFound('api.clientas.noEncontrada');

  const tiene: LoQueTiene = {
    citas: clienta._count.appointments,
    mapas: clienta._count.records,
    fichasFaciales: clienta._count.facialRecords,
    recibos: clienta._count.invoices,
    fotos: clienta._count.photoRecords,
    planes: clienta._count.plans,
    consentimientos: clienta._count.signedConsents,
    movimientos: clienta._count.stockMoves,
  };

  return {
    id: clienta.id,
    nombre: clienta.fullName,
    activo: clienta.active,
    tiene,
    sePuedeBorrar: Object.values(tiene).every((n) => n === 0),
  };
}

export function queTieneLaClienta(id: string): Promise<EstadoDeBorrado> {
  return contar(prisma, id);
}

/** «3 citas, 1 mapa facial…», traducido y con plurales. */
export function enPalabras(tiene: LoQueTiene, t: Traductor): string {
  return (Object.keys(tiene) as Array<keyof LoQueTiene>)
    .filter((k) => tiene[k] > 0)
    .map((k) => t(`api.clientas.cuenta.${k}`, { n: tiene[k] }))
    .join(', ');
}

export async function borrarClienta(id: string, t: Traductor): Promise<{ nombre: string }> {
  return prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM patients WHERE id = ${id} FOR UPDATE`;
    if (filas.length === 0) throw HttpError.notFound('api.clientas.noEncontrada');
    const estado = await contar(tx, id);
    if (!estado.sePuedeBorrar) {
      throw HttpError.unprocessable('api.clientas.noSePuedeBorrar', { nombre: estado.nombre, lista: enPalabras(estado.tiene, t) });
    }
    await tx.patient.delete({ where: { id } });
    return { nombre: estado.nombre };
  });
}

export async function archivarClienta(id: string): Promise<{ nombre: string }> {
  const clienta = await prisma.patient.findUnique({ where: { id }, select: { id: true, fullName: true } });
  if (!clienta) throw HttpError.notFound('api.clientas.noEncontrada');
  await prisma.patient.update({ where: { id }, data: { active: false } });
  return { nombre: clienta.fullName };
}
