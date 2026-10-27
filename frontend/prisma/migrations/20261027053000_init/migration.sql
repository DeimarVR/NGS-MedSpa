-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Idioma" AS ENUM ('ES', 'EN', 'FR', 'AR', 'JA');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PROFESIONAL', 'RECEPCION');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('TOXINA', 'RELLENO', 'PERFILADO', 'PIEL', 'PLANES', 'SIGNATURE', 'VALORACION');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMENINO', 'MASCULINO', 'OTRO', 'NO_DECLARA');

-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('NO', 'EMBARAZO', 'LACTANCIA', 'NO_DECLARA');

-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'GOOGLE', 'REFERIDA', 'PASABA_POR_AQUI', 'OTRO');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVO', 'PAUSADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PROGRAMADA', 'COMPLETADA', 'REPROGRAMADA', 'CANCELADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('ANTES', 'PROGRESO', 'DESPUES');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('WEB', 'TELEFONO', 'PRESENCIAL', 'INSTAGRAM', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RECIBO', 'COTIZACION');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'PAGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TARJETA', 'ZELLE', 'TRANSFERENCIA', 'FINANCIACION', 'OTRO');

-- CreateEnum
CREATE TYPE "SkinType" AS ENUM ('FITZ_I', 'FITZ_II', 'FITZ_III', 'FITZ_IV', 'FITZ_V', 'FITZ_VI');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('TOXINA', 'RELLENO', 'FOTOS', 'GENERAL');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('TOXINA', 'RELLENO', 'BIOESTIMULADOR', 'SKIN_BOOSTER', 'INSUMO', 'VENTA');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "StockMoveReason" AS ENUM ('COMPRA', 'USO_EN_PACIENTE', 'VENTA', 'DEVOLUCION', 'VENCIMIENTO', 'DANO', 'CONTEO', 'CORRECCION', 'OTRO');

-- CreateEnum
CREATE TYPE "FaceView" AS ENUM ('FRENTE', 'PERFIL_IZQ', 'PERFIL_DER');

-- CreateEnum
CREATE TYPE "TouchUpStatus" AS ENUM ('CONTACTADA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PROFESIONAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "locale" "Idioma" NOT NULL DEFAULT 'EN',
    "credentials" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "signature" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" "ServiceCategory" NOT NULL DEFAULT 'PIEL',
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "priceCents" INTEGER,
    "priceMode" TEXT NOT NULL DEFAULT 'DESDE',
    "touchUpDays" INTEGER,
    "icon" TEXT NOT NULL DEFAULT 'sparkles',
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "translations" JSONB NOT NULL DEFAULT '{}',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'NO_DECLARA',
    "address" TEXT,
    "city" TEXT,
    "preferredLocale" "Idioma" NOT NULL DEFAULT 'EN',
    "referralSource" "ReferralSource",
    "referralNote" TEXT,
    "instagram" TEXT,
    "allergies" TEXT,
    "medications" TEXT,
    "pregnancy" "PregnancyStatus" NOT NULL DEFAULT 'NO_DECLARA',
    "medicalNotes" TEXT,
    "publicToken" TEXT NOT NULL,
    "photoConsent" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "totalSessions" INTEGER NOT NULL DEFAULT 1,
    "intervalDays" INTEGER NOT NULL DEFAULT 28,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_sessions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "performedAt" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "professionalId" TEXT,
    "clinicalNotes" TEXT,
    "patientSummary" TEXT,
    "homeCare" TEXT,
    "productsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_photos" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL DEFAULT 'PROGRESO',
    "angle" TEXT NOT NULL DEFAULT 'frontal',
    "caption" TEXT,
    "visibleToPatient" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "patientId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "message" TEXT,
    "locale" "Idioma" NOT NULL DEFAULT 'EN',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "source" "AppointmentSource" NOT NULL DEFAULT 'WEB',
    "manageToken" TEXT NOT NULL,
    "confirmationSentAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blackouts" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "blackouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "consentSigned" BOOLEAN NOT NULL DEFAULT false,
    "publishable" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_record_items" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL DEFAULT 'PROGRESO',
    "angle" TEXT NOT NULL DEFAULT 'frontal',
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_record_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "locale" "Idioma" NOT NULL DEFAULT 'EN',
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "series" TEXT NOT NULL DEFAULT 'NGS',
    "type" "DocumentType" NOT NULL DEFAULT 'RECIBO',
    "status" "DocumentStatus" NOT NULL DEFAULT 'EMITIDA',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "locale" "Idioma" NOT NULL DEFAULT 'EN',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "signature" TEXT,
    "signedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'TARJETA',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "patientSignature" TEXT,
    "receivedSignature" TEXT,
    "receivedBy" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closes" (
    "id" TEXT NOT NULL,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "expectedCash" INTEGER NOT NULL,
    "expectedOther" INTEGER NOT NULL,
    "expectedTotal" INTEGER NOT NULL,
    "countedCash" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "invoiceCount" INTEGER NOT NULL,
    "invoicedTotal" INTEGER NOT NULL,
    "notes" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facial_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER,
    "patientPhone" TEXT,
    "skinType" "SkinType",
    "skinCondition" TEXT,
    "concerns" TEXT[],
    "allergies" TEXT,
    "contraindications" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facial_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facial_entries" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "sessionLabel" TEXT,
    "serviceId" TEXT,
    "zones" TEXT[],
    "productId" TEXT,
    "productName" TEXT,
    "lotId" TEXT,
    "lotNumber" TEXT,
    "quantity" DOUBLE PRECISION,
    "quantityUnit" TEXT,
    "technique" TEXT,
    "findings" TEXT,
    "homeCare" TEXT,
    "nextControl" TIMESTAMP(3),
    "nextControlTime" TEXT,
    "nextControlServiceId" TEXT,
    "nextControlAppointmentId" TEXT,
    "professionalSignature" TEXT,
    "patientSignature" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ConsentKind" NOT NULL DEFAULT 'GENERAL',
    "locale" "Idioma" NOT NULL DEFAULT 'EN',
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_consents" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "patientId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "kind" "ConsentKind" NOT NULL DEFAULT 'GENERAL',
    "locale" "Idioma" NOT NULL DEFAULT 'EN',
    "patientName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "professionalName" TEXT,
    "signedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signed_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'INSUMO',
    "brand" TEXT,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "packageSize" DOUBLE PRECISION,
    "packageLabel" TEXT,
    "applicationUnit" TEXT NOT NULL DEFAULT 'u',
    "applicationPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "presentation" TEXT,
    "category" TEXT,
    "salePrice" INTEGER,
    "supplier" TEXT,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitCost" INTEGER,
    "notes" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_moves" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "type" "StockMoveType" NOT NULL,
    "reason" "StockMoveReason" NOT NULL DEFAULT 'OTRO',
    "quantity" DOUBLE PRECISION NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,
    "clinicalEntryId" TEXT,
    "facialEntryId" TEXT,
    "correctsId" TEXT,
    "invoiceId" TEXT,
    "unitCost" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "procedureDate" TIMESTAMP(3) NOT NULL,
    "serviceId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER,
    "patientPhone" TEXT,
    "facePhotoUrl" TEXT,
    "appointmentId" TEXT,
    "notes" TEXT,
    "aftercare" TEXT,
    "nextControl" TIMESTAMP(3),
    "nextControlTime" TEXT,
    "nextControlServiceId" TEXT,
    "nextControlAppointmentId" TEXT,
    "professionalSignature" TEXT,
    "patientSignature" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_entries" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "view" "FaceView" NOT NULL DEFAULT 'FRENTE',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "zone" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "lotId" TEXT,
    "lotNumber" TEXT,
    "expiresAt" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'u',
    "technique" TEXT,
    "notes" TEXT,
    "appliedById" TEXT,
    "appliedByName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "touch_up_marks" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "baseDate" TIMESTAMP(3) NOT NULL,
    "status" "TouchUpStatus" NOT NULL,
    "notes" TEXT,
    "byId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "touch_up_marks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConsentTemplateToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConsentTemplateToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_active_sortOrder_idx" ON "services"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "patients_publicToken_key" ON "patients"("publicToken");

-- CreateIndex
CREATE INDEX "patients_fullName_idx" ON "patients"("fullName");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "patients_email_idx" ON "patients"("email");

-- CreateIndex
CREATE INDEX "treatment_plans_patientId_status_idx" ON "treatment_plans"("patientId", "status");

-- CreateIndex
CREATE INDEX "treatment_sessions_scheduledAt_idx" ON "treatment_sessions"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_sessions_planId_sessionNumber_key" ON "treatment_sessions"("planId", "sessionNumber");

-- CreateIndex
CREATE INDEX "session_photos_sessionId_angle_idx" ON "session_photos"("sessionId", "angle");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_manageToken_key" ON "appointments"("manageToken");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_sessionId_key" ON "appointments"("sessionId");

-- CreateIndex
CREATE INDEX "appointments_startsAt_status_idx" ON "appointments"("startsAt", "status");

-- CreateIndex
CREATE INDEX "appointments_patientId_startsAt_idx" ON "appointments"("patientId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_dayOfWeek_key" ON "business_hours"("dayOfWeek");

-- CreateIndex
CREATE INDEX "blackouts_startsAt_endsAt_idx" ON "blackouts"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "photo_records_patientId_createdAt_idx" ON "photo_records"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "photo_record_items_recordId_sortOrder_idx" ON "photo_record_items"("recordId", "sortOrder");

-- CreateIndex
CREATE INDEX "contact_messages_handled_createdAt_idx" ON "contact_messages"("handled", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_issueDate_idx" ON "invoices"("issueDate");

-- CreateIndex
CREATE INDEX "invoices_patientId_idx" ON "invoices"("patientId");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_closes_closeDate_key" ON "cash_closes"("closeDate");

-- CreateIndex
CREATE INDEX "cash_closes_closeDate_idx" ON "cash_closes"("closeDate");

-- CreateIndex
CREATE INDEX "facial_records_patientId_idx" ON "facial_records"("patientId");

-- CreateIndex
CREATE INDEX "facial_records_openedAt_idx" ON "facial_records"("openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "facial_entries_nextControlAppointmentId_key" ON "facial_entries"("nextControlAppointmentId");

-- CreateIndex
CREATE INDEX "facial_entries_recordId_idx" ON "facial_entries"("recordId");

-- CreateIndex
CREATE INDEX "consent_templates_active_name_idx" ON "consent_templates"("active", "name");

-- CreateIndex
CREATE INDEX "signed_consents_patientId_signedAt_idx" ON "signed_consents"("patientId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_active_name_idx" ON "products"("active", "name");

-- CreateIndex
CREATE INDEX "lots_expiresAt_idx" ON "lots"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "lots_productId_lotNumber_key" ON "lots"("productId", "lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "stock_moves_clinicalEntryId_key" ON "stock_moves"("clinicalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_moves_facialEntryId_key" ON "stock_moves"("facialEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_moves_correctsId_key" ON "stock_moves"("correctsId");

-- CreateIndex
CREATE INDEX "stock_moves_productId_occurredAt_idx" ON "stock_moves"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_moves_lotId_idx" ON "stock_moves"("lotId");

-- CreateIndex
CREATE INDEX "stock_moves_patientId_idx" ON "stock_moves"("patientId");

-- CreateIndex
CREATE INDEX "stock_moves_occurredAt_idx" ON "stock_moves"("occurredAt");

-- CreateIndex
CREATE INDEX "stock_moves_invoiceId_idx" ON "stock_moves"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_appointmentId_key" ON "clinical_records"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_records_nextControlAppointmentId_key" ON "clinical_records"("nextControlAppointmentId");

-- CreateIndex
CREATE INDEX "clinical_records_patientId_idx" ON "clinical_records"("patientId");

-- CreateIndex
CREATE INDEX "clinical_records_procedureDate_idx" ON "clinical_records"("procedureDate");

-- CreateIndex
CREATE INDEX "clinical_entries_recordId_idx" ON "clinical_entries"("recordId");

-- CreateIndex
CREATE INDEX "clinical_entries_lotId_idx" ON "clinical_entries"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "touch_up_marks_patientId_serviceId_baseDate_key" ON "touch_up_marks"("patientId", "serviceId", "baseDate");

-- CreateIndex
CREATE INDEX "_ConsentTemplateToService_B_index" ON "_ConsentTemplateToService"("B");

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_records" ADD CONSTRAINT "photo_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_records" ADD CONSTRAINT "photo_records_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_records" ADD CONSTRAINT "photo_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_record_items" ADD CONSTRAINT "photo_record_items_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "photo_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_records" ADD CONSTRAINT "facial_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_records" ADD CONSTRAINT "facial_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "facial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_nextControlServiceId_fkey" FOREIGN KEY ("nextControlServiceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_nextControlAppointmentId_fkey" FOREIGN KEY ("nextControlAppointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "consent_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_clinicalEntryId_fkey" FOREIGN KEY ("clinicalEntryId") REFERENCES "clinical_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_facialEntryId_fkey" FOREIGN KEY ("facialEntryId") REFERENCES "facial_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_correctsId_fkey" FOREIGN KEY ("correctsId") REFERENCES "stock_moves"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_nextControlServiceId_fkey" FOREIGN KEY ("nextControlServiceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_entries" ADD CONSTRAINT "clinical_entries_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "clinical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_entries" ADD CONSTRAINT "clinical_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_entries" ADD CONSTRAINT "clinical_entries_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_entries" ADD CONSTRAINT "clinical_entries_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "touch_up_marks" ADD CONSTRAINT "touch_up_marks_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "touch_up_marks" ADD CONSTRAINT "touch_up_marks_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "touch_up_marks" ADD CONSTRAINT "touch_up_marks_byId_fkey" FOREIGN KEY ("byId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsentTemplateToService" ADD CONSTRAINT "_ConsentTemplateToService_A_fkey" FOREIGN KEY ("A") REFERENCES "consent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsentTemplateToService" ADD CONSTRAINT "_ConsentTemplateToService_B_fkey" FOREIGN KEY ("B") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
