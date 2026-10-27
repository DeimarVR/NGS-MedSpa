import { DocumentStatus, DocumentType, type Prisma } from '@/generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { toZonedDateKey } from '../../lib/datetime';
import { condicionPorNumero } from '../../lib/numeroDeDocumento';
import { variantesDeAcento } from '../../lib/acentos';

/**
 * Por cobrar: lo emitido que no se ha pagado, agrupado por clienta. Arriba va
 * quien tiene la deuda más reciente: es a quien todavía se le puede cobrar con
 * naturalidad.
 */
export interface ReciboPendiente {
  id: string;
  numero: string;
  issueDate: Date;
  total: number;
  deposit: number;
  balance: number;
  dias: number;
}

export interface ClientaQueDebe {
  clave: string;
  nombre: string;
  patientId: string | null;
  correo: string | null;
  telefono: string | null;
  debe: number;
  recibos: ReciboPendiente[];
  diasDelMasViejo: number;
  diasDelMasNuevo: number;
}

function llaveDeNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function diasEntreClaves(desde: string, hasta: string): number {
  const utc = (clave: string) => {
    const [a, m, d] = clave.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.max(0, Math.round((utc(hasta) - utc(desde)) / 86_400_000));
}

function condicionDeBusqueda(q: string): Prisma.InvoiceWhereInput[] {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => ({
      OR: [
        ...variantesDeAcento(palabra).map((v) => ({ clientName: { contains: v, mode: 'insensitive' as const } })),
        { clientEmail: { contains: palabra, mode: 'insensitive' as const } },
        { clientPhone: { contains: palabra.replace(/\D/g, '') || palabra } },
        ...condicionPorNumero(palabra),
      ],
    }));
}

export async function clientasQueDeben(consulta: { q?: string } = {}) {
  const q = consulta.q?.trim();
  const recibos = await prisma.invoice.findMany({
    where: {
      type: DocumentType.RECIBO,
      status: DocumentStatus.EMITIDA,
      balance: { gt: 0 },
      ...(q ? { AND: condicionDeBusqueda(q) } : {}),
    },
    select: {
      id: true,
      number: true,
      series: true,
      issueDate: true,
      total: true,
      deposit: true,
      balance: true,
      patientId: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
    },
    orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
  });

  const hoy = toZonedDateKey(new Date(), env.CLINIC_TIMEZONE);
  const porClienta = new Map<string, ClientaQueDebe>();

  for (const r of recibos) {
    const clave = r.patientId ?? `nombre:${llaveDeNombre(r.clientName)}`;
    let c = porClienta.get(clave);
    if (!c) {
      c = {
        clave,
        nombre: r.clientName,
        patientId: r.patientId,
        correo: r.clientEmail,
        telefono: r.clientPhone,
        debe: 0,
        recibos: [],
        diasDelMasViejo: 0,
        diasDelMasNuevo: Number.MAX_SAFE_INTEGER,
      };
      porClienta.set(clave, c);
    }
    const dias = diasEntreClaves(r.issueDate.toISOString().slice(0, 10), hoy);
    c.debe += r.balance;
    c.diasDelMasViejo = Math.max(c.diasDelMasViejo, dias);
    c.diasDelMasNuevo = Math.min(c.diasDelMasNuevo, dias);
    c.recibos.push({
      id: r.id,
      numero: `${r.series}-${String(r.number).padStart(4, '0')}`,
      issueDate: r.issueDate,
      total: r.total,
      deposit: r.deposit,
      balance: r.balance,
      dias,
    });
    if (!c.telefono && r.clientPhone) c.telefono = r.clientPhone;
    if (!c.correo && r.clientEmail) c.correo = r.clientEmail;
  }

  const items = [...porClienta.values()].sort((a, b) => a.diasDelMasNuevo - b.diasDelMasNuevo || b.debe - a.debe);
  return { items, debenEnTotal: items.reduce((s, c) => s + c.debe, 0), clientas: items.length };
}
