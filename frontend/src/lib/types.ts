/**
 * Contratos compartidos con la API, para el navegador. Reflejan lo que
 * devuelve el servidor (las fechas llegan como texto ISO y el dinero, en
 * centavos de dólar).
 *
 * No se importan los tipos de Prisma aquí a propósito: el cliente generado
 * trae código de servidor y no debe acabar en el paquete del navegador.
 */
import type { Locale } from '@/i18n/routing';

export type Role = 'ADMIN' | 'PROFESIONAL' | 'RECEPCION';
export type Gender = 'FEMENINO' | 'MASCULINO' | 'OTRO' | 'NO_DECLARA';
export type PregnancyStatus = 'NO' | 'EMBARAZO' | 'LACTANCIA' | 'NO_DECLARA';
export type ReferralSource = 'INSTAGRAM' | 'TIKTOK' | 'FACEBOOK' | 'GOOGLE' | 'REFERIDA' | 'PASABA_POR_AQUI' | 'OTRO';
export type PlanStatus = 'ACTIVO' | 'PAUSADO' | 'FINALIZADO' | 'CANCELADO';
export type SessionStatus = 'PROGRAMADA' | 'COMPLETADA' | 'REPROGRAMADA' | 'CANCELADA' | 'NO_ASISTIO';
export type AppointmentStatus = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA' | 'NO_ASISTIO';
export type AppointmentSource = 'WEB' | 'TELEFONO' | 'PRESENCIAL' | 'INSTAGRAM' | 'WHATSAPP';
export type PhotoType = 'ANTES' | 'PROGRESO' | 'DESPUES';
export type ServiceCategory = 'TOXINA' | 'RELLENO' | 'PERFILADO' | 'PIEL' | 'PLANES' | 'SIGNATURE' | 'VALORACION';
export type DocumentType = 'RECIBO' | 'COTIZACION';
export type DocumentStatus = 'BORRADOR' | 'EMITIDA' | 'PAGADA' | 'ANULADA';
export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'ZELLE' | 'TRANSFERENCIA' | 'FINANCIACION' | 'OTRO';
export type SkinType = 'FITZ_I' | 'FITZ_II' | 'FITZ_III' | 'FITZ_IV' | 'FITZ_V' | 'FITZ_VI';
export type ConsentKind = 'TOXINA' | 'RELLENO' | 'FOTOS' | 'GENERAL';
export type ProductKind = 'TOXINA' | 'RELLENO' | 'BIOESTIMULADOR' | 'SKIN_BOOSTER' | 'INSUMO' | 'VENTA';
export type StockMoveType = 'ENTRADA' | 'SALIDA' | 'AJUSTE';
export type StockMoveReason =
  | 'COMPRA'
  | 'USO_EN_PACIENTE'
  | 'VENTA'
  | 'DEVOLUCION'
  | 'VENCIMIENTO'
  | 'DANO'
  | 'CONTEO'
  | 'CORRECCION'
  | 'OTRO';
export type FaceView = 'FRENTE' | 'PERFIL_IZQ' | 'PERFIL_DER';
export type TouchUpStatus = 'CONTACTADA' | 'DESCARTADA';

export const ROLES: Role[] = ['ADMIN', 'PROFESIONAL', 'RECEPCION'];
export const ESTADOS_CITA: AppointmentStatus[] = ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'NO_ASISTIO', 'CANCELADA'];
export const ORIGENES_CITA: AppointmentSource[] = ['WEB', 'TELEFONO', 'PRESENCIAL', 'INSTAGRAM', 'WHATSAPP'];
export const CATEGORIAS: ServiceCategory[] = ['VALORACION', 'TOXINA', 'RELLENO', 'PERFILADO', 'PIEL', 'PLANES', 'SIGNATURE'];
export const METODOS_PAGO: PaymentMethod[] = ['TARJETA', 'EFECTIVO', 'ZELLE', 'TRANSFERENCIA', 'FINANCIACION', 'OTRO'];
export const TIPOS_PRODUCTO: ProductKind[] = ['TOXINA', 'RELLENO', 'BIOESTIMULADOR', 'SKIN_BOOSTER', 'INSUMO', 'VENTA'];
export const FOTOTIPOS: SkinType[] = ['FITZ_I', 'FITZ_II', 'FITZ_III', 'FITZ_IV', 'FITZ_V', 'FITZ_VI'];
export const ORIGENES_CLIENTA: ReferralSource[] = ['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'GOOGLE', 'REFERIDA', 'PASABA_POR_AQUI', 'OTRO'];

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  locale: Locale;
  credentials?: string | null;
  signature?: string | null;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  shortDesc: string;
  description: string;
  category: ServiceCategory;
  durationMin: number;
  priceCents: number | null;
  priceMode: string;
  touchUpDays: number | null;
  icon: string;
  benefits: string[];
  featured: boolean;
  active: boolean;
  published: boolean;
  sortOrder: number;
  translations?: Partial<Record<Locale, { name?: string; shortDesc?: string; description?: string }>>;
}

/* --- Agenda ---------------------------------------------------------------- */

export type MotivoNoDisponible = 'ocupado' | 'pausa' | 'muy-pronto' | 'muy-lejos';

export interface TimeSlot {
  time: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  motivo?: MotivoNoDisponible;
  cupos?: number;
  cuposLibres?: number;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  open: boolean;
  slots: TimeSlot[];
  availableCount: number;
}

export interface AvailabilityResponse {
  service: { id: string; name: string; durationMin: number };
  timezone: string;
  maxAdvanceDays: number;
  days: DayAvailability[];
}

export interface AppointmentListItem {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  message: string | null;
  manageToken: string;
  locale: string;
  updatedAt: string;
  createdAt: string;
  service: { id: string; name: string; slug: string; durationMin: number; category: ServiceCategory };
  patient: { id: string; fullName: string; publicToken: string } | null;
}

export interface ManagedAppointment {
  id: string;
  contactName: string;
  service: { name: string; durationMin: number; slug: string };
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  clinic: { name: string; address: string; phone: string };
}

export interface BookingResponse {
  appointment: { id: string; startsAt: string; endsAt: string; status: AppointmentStatus };
  manageToken: string;
  manageUrl: string;
}

/* --- Clientas -------------------------------------------------------------- */

export interface PatientListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  instagram: string | null;
  city: string | null;
  preferredLocale: string;
  active: boolean;
  updatedAt: string;
  publicToken: string;
  _count: { appointments: number; records: number };
}

export interface Patient {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  birthDate: string | null;
  gender: Gender;
  address: string | null;
  city: string | null;
  preferredLocale: Locale;
  referralSource: ReferralSource | null;
  referralNote: string | null;
  instagram: string | null;
  allergies: string | null;
  medications: string | null;
  pregnancy: PregnancyStatus;
  medicalNotes: string | null;
  publicToken: string;
  photoConsent: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Una entrada del historial de la clienta. */
export type TipoHecho = 'mapa' | 'ficha-facial' | 'consentimiento' | 'fotos' | 'producto' | 'cita' | 'recibo';

export interface Hecho {
  id: string;
  tipo: TipoHecho;
  fecha: string;
  titulo: string;
  detalle?: string | null;
  enlace?: string;
}

/* --- Retoques -------------------------------------------------------------- */

export interface Retoque {
  clave: string;
  patientId: string;
  patientName: string;
  phone: string;
  email: string | null;
  preferredLocale: Locale;
  serviceId: string;
  serviceName: string;
  serviceNameClienta: string;
  category: ServiceCategory;
  baseDate: string;
  ultimaVez: string;
  tocaEl: string;
  diasDeRetraso: number;
  /** Texto listo para mandar a mano, en el idioma de la clienta. */
  mensaje?: string;
}

/* --- Seguimiento de la clienta (enlace público) ----------------------------- */

export interface PatientProgress {
  patient: { firstName: string; fullName: string; memberSince: string };
  visitas: Array<{ id: string; fecha: string; tratamiento: string; indicaciones: string | null; proximo: string | null }>;
  proximasCitas: Array<{ id: string; serviceName: string; startsAt: string; status: AppointmentStatus; manageToken: string }>;
  retoques: Array<{ serviceName: string; tocaEl: string }>;
  clinic: { name: string; phone: string; address: string };
}

/* --- Inventario ------------------------------------------------------------ */

export interface Lote {
  id: string;
  lotNumber: string;
  expiresAt: string | null;
  receivedAt: string;
  unitCost: number | null;
  blocked: boolean;
  notes: string | null;
  stock: number;
  vencido: boolean;
  porVencer: boolean;
}

export interface Producto {
  id: string;
  name: string;
  kind: ProductKind;
  brand: string | null;
  sku: string | null;
  unit: string;
  packageSize: number | null;
  packageLabel: string | null;
  applicationUnit: string;
  applicationPerUnit: number;
  presentation: string | null;
  category: string | null;
  salePrice: number | null;
  supplier: string | null;
  minStock: number;
  notes: string | null;
  active: boolean;
  stock: number;
  bajo: boolean;
  movimientos: number;
  venceEl: string | null;
  vencido: boolean;
  porVencer: boolean;
  lotes: Lote[];
}

/* --- Mapa facial ------------------------------------------------------------ */

export interface PuntoMapa {
  id: string;
  view: FaceView;
  x: number;
  y: number;
  zone: string;
  productId: string | null;
  productName: string;
  lotId: string | null;
  lotNumber: string | null;
  expiresAt: string | null;
  quantity: number;
  unit: string;
  technique: string | null;
  notes: string | null;
  appliedById: string | null;
  appliedByName: string | null;
  product: { id: string; name: string; kind: ProductKind; applicationUnit: string } | null;
  lot: { id: string; lotNumber: string; expiresAt: string | null; blocked: boolean } | null;
}

export interface MapaFacial {
  id: string;
  patientId: string;
  procedureDate: string;
  serviceId: string | null;
  patientName: string;
  patientAge: number | null;
  patientPhone: string | null;
  facePhotoUrl: string | null;
  appointmentId: string | null;
  notes: string | null;
  aftercare: string | null;
  nextControl: string | null;
  nextControlTime: string | null;
  nextControlServiceId: string | null;
  professionalSignature: string | null;
  patientSignature: string | null;
  updatedAt: string;
  createdAt: string;
  entries: PuntoMapa[];
  patient: { id: string; fullName: string; phone: string; preferredLocale: string; allergies: string | null; medications: string | null; pregnancy: PregnancyStatus; birthDate: string | null };
  service: { id: string; name: string; category: ServiceCategory } | null;
  nextControlService: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string } | null;
  nextControlAppointment: { id: string; startsAt: string; status: AppointmentStatus } | null;
  avisos?: string[];
}

/* --- Ficha de piel ---------------------------------------------------------- */

export interface SesionPiel {
  id: string;
  sessionDate: string;
  sessionLabel: string | null;
  serviceId: string | null;
  zones: string[];
  productId: string | null;
  productName: string | null;
  lotId: string | null;
  lotNumber: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  technique: string | null;
  findings: string | null;
  homeCare: string | null;
  nextControl: string | null;
  nextControlTime: string | null;
  nextControlServiceId: string | null;
  professionalSignature: string | null;
  patientSignature: string | null;
  service: { id: string; name: string } | null;
  nextControlAppointment: { id: string; startsAt: string; status: AppointmentStatus } | null;
}

export interface FichaPiel {
  id: string;
  patientId: string;
  openedAt: string;
  patientName: string;
  patientAge: number | null;
  patientPhone: string | null;
  skinType: SkinType | null;
  skinCondition: string | null;
  concerns: string[];
  allergies: string | null;
  contraindications: string | null;
  notes: string | null;
  updatedAt: string;
  entries: SesionPiel[];
  patient: { id: string; fullName: string; phone: string; preferredLocale: string };
  createdBy: { fullName: string } | null;
  avisos?: string[];
}

/* --- Consentimientos ------------------------------------------------------- */

export interface PlantillaConsentimiento {
  id: string;
  name: string;
  description: string | null;
  kind: ConsentKind;
  locale: 'ES' | 'EN' | 'FR' | 'AR' | 'JA';
  body: string;
  version: number;
  active: boolean;
  services: Array<{ id: string; name: string }>;
  _count?: { signatures: number };
  updatedAt: string;
}

export interface ConsentimientoFirmado {
  id: string;
  templateId: string | null;
  patientId: string;
  templateName: string;
  templateVersion: number;
  kind: ConsentKind;
  locale: string;
  patientName: string;
  signedAt: string;
  fileUrl: string;
  professionalName: string | null;
  notes: string | null;
  patient: { id: string; fullName: string };
  signedBy: { fullName: string } | null;
}

/* --- Fotos ------------------------------------------------------------------ */

export interface FotoRegistro {
  id: string;
  url: string;
  type: PhotoType;
  angle: string;
  caption: string | null;
  takenAt: string;
  sortOrder: number;
}

export interface RegistroFotos {
  id: string;
  patientId: string;
  serviceId: string | null;
  title: string;
  notes: string | null;
  consentSigned: boolean;
  publishable: boolean;
  createdAt: string;
  updatedAt: string;
  photos: FotoRegistro[];
  patient: { id: string; fullName: string; phone: string; photoConsent: boolean };
  service: { id: string; name: string } | null;
}

/* --- Recibos ------------------------------------------------------------------ */

export interface LineaRecibo {
  id: string;
  quantity: number;
  description: string;
  unitPrice: number;
  total: number;
  sortOrder: number;
  productId: string | null;
}

export interface Pago {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  receivedBy: string | null;
  createdBy?: { fullName: string } | null;
}

export interface Recibo {
  id: string;
  number: number;
  series: string;
  type: DocumentType;
  status: DocumentStatus;
  issueDate: string;
  patientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  locale: string;
  subtotal: number;
  discount: number;
  taxRateBps: number;
  tax: number;
  total: number;
  deposit: number;
  balance: number;
  notes: string | null;
  signature?: string | null;
  signedBy: string | null;
  createdAt: string;
  updatedAt: string;
  items: LineaRecibo[];
  payments: Pago[];
  patient: { id: string; fullName: string; phone?: string; email?: string | null } | null;
  createdBy?: { id: string; fullName: string } | null;
}

export interface ResumenCaja {
  desde: string;
  hasta: string;
  cobrado: number;
  cobradoPorMedio: Record<PaymentMethod, number>;
  pagos: number;
  facturado: number;
  documentos: number;
  porCobrar: number;
}
