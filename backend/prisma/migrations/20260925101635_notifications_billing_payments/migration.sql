-- CreateEnum
CREATE TYPE "ChargeCategory" AS ENUM ('SERVICE', 'PROPERTY_TAX', 'WATER', 'LIFT', 'PARKING', 'NON_OCCUPANCY', 'INSURANCE', 'LEASE_RENT', 'LOAN', 'SINKING_FUND', 'REPAIR_FUND', 'MAJOR_REPAIR_FUND', 'EDUCATION_FUND', 'ELECTION_FUND', 'WELFARE_FUND', 'OTHER_FUND', 'AMENITY', 'COMMON_AREA', 'COMMERCIAL_SURCHARGE', 'GB_APPROVED_OTHER', 'OTHER');

-- CreateEnum
CREATE TYPE "ApportionmentMethod" AS ENUM ('EQUAL_PER_UNIT', 'PER_CARPET_AREA', 'PER_WATER_INLET', 'BUILDING_SCOPED_EQUAL', 'PER_PARKING_SLOT', 'PERCENT_OF_HEAD', 'PERCENT_OF_CONSTRUCTION_COST', 'PER_MEMBER_FIXED_OR_MIN', 'FIXED_PER_UNIT_TYPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "BillRunStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillKind" AS ENUM ('REGULAR', 'SUPPLEMENTARY');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('OPENING', 'BILL', 'PAYMENT', 'CREDIT_NOTE', 'REVERSAL', 'ADVANCE_APPLIED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('ONLINE', 'UPI', 'CASH', 'CHEQUE', 'NEFT', 'RTGS', 'IMPS', 'OTHER');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationBucket" AS ENUM ('INTEREST', 'PRINCIPAL', 'ADVANCE');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('BILLING', 'PAYMENT', 'NOTICE', 'EMERGENCY', 'APPROVAL', 'ACCOUNT', 'REPORT', 'GENERAL');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "charge_heads" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "name_mr" VARCHAR(80),
    "category" "ChargeCategory" NOT NULL,
    "method" "ApportionmentMethod" NOT NULL,
    "gst_applicable" BOOLEAN NOT NULL DEFAULT false,
    "base_head_id" UUID,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "resolution" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "charge_heads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_rates" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "head_id" UUID NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "rate_by_type" JSONB,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "resolution" JSONB,
    "note" VARCHAR(300),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charge_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_charges" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "head_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_runs" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "bill_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "BillRunStatus" NOT NULL DEFAULT 'DRAFT',
    "bill_count" INTEGER NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "exceptions" JSONB NOT NULL DEFAULT '[]',
    "created_by" UUID NOT NULL,
    "published_by" UUID,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bill_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "bill_run_id" UUID,
    "unit_id" UUID NOT NULL,
    "kind" "BillKind" NOT NULL DEFAULT 'REGULAR',
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "number" VARCHAR(60),
    "fy" VARCHAR(9) NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "bill_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_paise" BIGINT NOT NULL,
    "interest_paise" BIGINT NOT NULL DEFAULT 0,
    "gst_paise" BIGINT NOT NULL DEFAULT 0,
    "rounding_paise" BIGINT NOT NULL DEFAULT 0,
    "total_paise" BIGINT NOT NULL,
    "principal_paid_paise" BIGINT NOT NULL DEFAULT 0,
    "interest_paid_paise" BIGINT NOT NULL DEFAULT 0,
    "arrears_paise" BIGINT NOT NULL DEFAULT 0,
    "payer_name" VARCHAR(100),
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_lines" (
    "id" UUID NOT NULL,
    "bill_id" UUID NOT NULL,
    "head_id" UUID,
    "code" VARCHAR(20) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'CHARGE',
    "method" VARCHAR(40),
    "rate" VARCHAR(40),
    "rate_id" UUID,
    "input" VARCHAR(60),
    "basis" VARCHAR(200) NOT NULL,
    "rule_ref" VARCHAR(100),
    "amount_paise" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "ref_type" VARCHAR(30) NOT NULL,
    "ref_id" UUID NOT NULL,
    "debit_paise" BIGINT NOT NULL DEFAULT 0,
    "credit_paise" BIGINT NOT NULL DEFAULT 0,
    "narration" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "bill_id" UUID,
    "number" VARCHAR(60) NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "gateway" VARCHAR(20),
    "gateway_order_id" VARCHAR(100),
    "gateway_payment_id" VARCHAR(100),
    "instrument_no" VARCHAR(40),
    "instrument_date" DATE,
    "bank_name" VARCHAR(100),
    "remarks" VARCHAR(300),
    "failure_reason" VARCHAR(300),
    "payer_user_id" UUID,
    "recorded_by" UUID,
    "paid_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "fy" VARCHAR(9) NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "bill_id" UUID,
    "bucket" "AllocationBucket" NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateway_events" (
    "id" UUID NOT NULL,
    "gateway" VARCHAR(20) NOT NULL,
    "event_id" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gateway_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(4096) NOT NULL,
    "app" VARCHAR(20) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "device_name" VARCHAR(100),
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "society_id" UUID,
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "target" VARCHAR(254),
    "provider_ref" VARCHAR(200),
    "error" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "audience" JSONB NOT NULL,
    "ack_required" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "channels" TEXT[],
    "status" "NoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "emergency_reason" VARCHAR(300),
    "expires_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "supersedes_id" UUID,
    "created_by" UUID NOT NULL,
    "published_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_recipients" (
    "id" UUID NOT NULL,
    "notice_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "unit_label" VARCHAR(40),
    "notification_id" UUID,
    "read_at" TIMESTAMPTZ(3),
    "acknowledged_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charge_heads_society_id_code_key" ON "charge_heads"("society_id", "code");

-- CreateIndex
CREATE INDEX "charge_rates_head_id_effective_from_idx" ON "charge_rates"("head_id", "effective_from");

-- CreateIndex
CREATE INDEX "unit_charges_society_id_head_id_idx" ON "unit_charges"("society_id", "head_id");

-- CreateIndex
CREATE INDEX "unit_charges_unit_id_idx" ON "unit_charges"("unit_id");

-- CreateIndex
CREATE INDEX "bill_runs_society_id_period_idx" ON "bill_runs"("society_id", "period");

-- CreateIndex
CREATE INDEX "bills_society_id_unit_id_status_due_date_idx" ON "bills"("society_id", "unit_id", "status", "due_date");

-- CreateIndex
CREATE INDEX "bills_society_id_period_idx" ON "bills"("society_id", "period");

-- CreateIndex
CREATE INDEX "bill_lines_bill_id_idx" ON "bill_lines"("bill_id");

-- CreateIndex
CREATE INDEX "ledger_entries_society_id_unit_id_date_idx" ON "ledger_entries"("society_id", "unit_id", "date");

-- CreateIndex
CREATE INDEX "credit_notes_society_id_unit_id_idx" ON "credit_notes"("society_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_order_id_key" ON "payments"("gateway_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gateway_payment_id_key" ON "payments"("gateway_payment_id");

-- CreateIndex
CREATE INDEX "payments_society_id_unit_id_created_at_idx" ON "payments"("society_id", "unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_society_id_status_idx" ON "payments"("society_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_payment_id_key" ON "receipts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_society_id_number_key" ON "receipts"("society_id", "number");

-- CreateIndex
CREATE INDEX "allocations_society_id_unit_id_bucket_idx" ON "allocations"("society_id", "unit_id", "bucket");

-- CreateIndex
CREATE INDEX "allocations_bill_id_idx" ON "allocations"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "gateway_events_gateway_event_id_key" ON "gateway_events"("gateway", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_idx" ON "notification_deliveries"("notification_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_category_key" ON "notification_preferences"("user_id", "category");

-- CreateIndex
CREATE INDEX "notices_society_id_status_published_at_idx" ON "notices"("society_id", "status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "notice_recipients_user_id_idx" ON "notice_recipients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notice_recipients_notice_id_user_id_key" ON "notice_recipients"("notice_id", "user_id");

-- AddForeignKey
ALTER TABLE "charge_rates" ADD CONSTRAINT "charge_rates_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "charge_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_bill_run_id_fkey" FOREIGN KEY ("bill_run_id") REFERENCES "bill_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
