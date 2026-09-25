-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('OWNER', 'CO_OWNER', 'FAMILY', 'TENANT', 'GUARD', 'STAFF', 'ACCOUNTANT', 'AUDITOR', 'COMMITTEE', 'MANAGER');

-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('ACTIVATED', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOCKED', 'UNLOCKED', 'PASSWORD_CHANGED', 'TEMP_PASSWORD_ISSUED', 'SESSION_REVOKED', 'ALL_SESSIONS_REVOKED', 'REFRESH_REUSE_DETECTED', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED', 'SUSPENDED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "SocietyType" AS ENUM ('SOCIETY_CHS', 'SOCIETY_AOA', 'UNREGISTERED');

-- CreateEnum
CREATE TYPE "SocietyStatus" AS ENUM ('DRAFT', 'LIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'SHOP', 'OFFICE', 'PARKING_ONLY');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ParkingType" AS ENUM ('CAR_COVERED', 'CAR_OPEN', 'CAR_STILT', 'TWO_WHEELER', 'VISITOR');

-- CreateEnum
CREATE TYPE "BankPurpose" AS ENUM ('OPERATIONS', 'SINKING', 'REPAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('SAVINGS', 'CURRENT');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY');

-- CreateEnum
CREATE TYPE "MembershipKind" AS ENUM ('PRIMARY', 'CO_OWNER', 'ASSOCIATE');

-- CreateEnum
CREATE TYPE "OccupancyStatus" AS ENUM ('SELF_OCCUPIED', 'FAMILY_OCCUPIED', 'TENANTED', 'VACANT', 'LOCKED', 'UNDER_RENOVATION');

-- CreateEnum
CREATE TYPE "BillPayer" AS ENUM ('OWNER', 'TENANT');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'TWO_WHEELER', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('FAMILY_ADD', 'VEHICLE_ADD', 'PET_ADD', 'TENANT_ADD', 'PROFILE_CHANGE', 'DATA_CORRECTION');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254),
    "language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "password_hash" TEXT,
    "password_changed_at" TIMESTAMPTZ(3),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMPTZ(3),
    "terms_accepted_at" TIMESTAMPTZ(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "totp_secret" TEXT,
    "totp_pending_secret" TEXT,
    "totp_enabled_at" TIMESTAMPTZ(3),
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "society_users" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "user_type" "UserType" NOT NULL,
    "permissions" TEXT[],
    "unit_id" UUID,
    "notes" VARCHAR(500),
    "suspended_at" TIMESTAMPTZ(3),
    "suspended_reason" VARCHAR(300),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "society_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_templates" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "role" "Role" NOT NULL,
    "user_type" "UserType" NOT NULL,
    "permissions" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "previous_hash" TEXT,
    "client" VARCHAR(20) NOT NULL,
    "device_id" VARCHAR(100),
    "device_name" VARCHAR(100),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(60),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temp_passwords" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "issued_by" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "superseded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temp_passwords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(10) NOT NULL,
    "ip" VARCHAR(64),
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "society_id" UUID,
    "actor_id" UUID,
    "type" "AuthEventType" NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "detail" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "society_id" UUID,
    "actor_id" UUID,
    "actor_name" VARCHAR(100),
    "action" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(60),
    "permission" VARCHAR(40),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "request_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint_id" VARCHAR(80) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" UUID NOT NULL,
    "society_id" UUID,
    "user_id" UUID,
    "channel" VARCHAR(20) NOT NULL,
    "to" VARCHAR(254) NOT NULL,
    "template" VARCHAR(60) NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    "provider_ref" VARCHAR(100),
    "error" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "societies" (
    "id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "SocietyType" NOT NULL,
    "status" "SocietyStatus" NOT NULL DEFAULT 'DRAFT',
    "registration_number" VARCHAR(60),
    "registration_date" DATE,
    "address_line" VARCHAR(300),
    "city" VARCHAR(80),
    "district" VARCHAR(80),
    "pincode" VARCHAR(6),
    "registrar_office" VARCHAR(150),
    "pan" VARCHAR(10),
    "tan" VARCHAR(10),
    "gstin" VARCHAR(15),
    "gst_registered" BOOLEAN NOT NULL DEFAULT false,
    "fy_start_month" INTEGER NOT NULL DEFAULT 4,
    "contact_email" VARCHAR(254),
    "contact_phone" VARCHAR(20),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "went_live_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "societies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "wing" VARCHAR(20),
    "floor_count" INTEGER NOT NULL,
    "lift_present" BOOLEAN NOT NULL,
    "construction_year" INTEGER,
    "construction_cost_paise" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "floor" INTEGER NOT NULL,
    "type" "UnitType" NOT NULL DEFAULT 'RESIDENTIAL',
    "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "carpet_area_sqft" DECIMAL(10,2),
    "built_up_area_sqft" DECIMAL(10,2),
    "water_inlets" INTEGER NOT NULL DEFAULT 1,
    "lift_served" BOOLEAN NOT NULL,
    "share_certificate_no" VARCHAR(40),
    "first_billed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_slots" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "building_id" UUID,
    "code" VARCHAR(20) NOT NULL,
    "type" "ParkingType" NOT NULL,
    "unit_id" UUID,
    "allotted_at" TIMESTAMPTZ(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_name" VARCHAR(150) NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "ifsc" VARCHAR(11) NOT NULL,
    "type" "BankAccountType" NOT NULL,
    "purpose" "BankPurpose" NOT NULL,
    "opening_balance_paise" BIGINT NOT NULL DEFAULT 0,
    "opening_balance_date" DATE,
    "van_prefix" VARCHAR(20),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_configs" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "generation_day" INTEGER NOT NULL DEFAULT 1,
    "due_day" INTEGER NOT NULL DEFAULT 15,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "interest_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "interest_resolution" JSONB,
    "rounding_rule" VARCHAR(20) NOT NULL DEFAULT 'NEAREST_RUPEE',
    "bill_number_format" VARCHAR(60) NOT NULL DEFAULT '{CODE}/{FY}/{SEQ}',
    "receipt_number_format" VARCHAR(60) NOT NULL DEFAULT '{CODE}/R/{FY}/{SEQ}',
    "allow_partial_payment" BOOLEAN NOT NULL DEFAULT true,
    "allocation_order" TEXT[] DEFAULT ARRAY['INTEREST', 'ARREARS', 'CURRENT']::TEXT[],
    "effective_from_period" VARCHAR(7),
    "configured_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "billing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numbering_series" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "series" VARCHAR(30) NOT NULL,
    "fy" VARCHAR(9) NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "numbering_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_config" (
    "id" UUID NOT NULL,
    "society_id" UUID,
    "key" VARCHAR(60) NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "unit" VARCHAR(30),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "source_reference" VARCHAR(500),
    "rule_citation" VARCHAR(200),
    "verified_on" DATE,
    "resolution_reference" JSONB,
    "set_by" UUID,
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "dry_run" BOOLEAN NOT NULL,
    "total" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "errors" JSONB NOT NULL,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "mobile" VARCHAR(10),
    "email" VARCHAR(254),
    "user_id" UUID,
    "directory_listed" BOOLEAN NOT NULL DEFAULT true,
    "directory_show_mobile" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "kind" "MembershipKind" NOT NULL,
    "share_certificate_no" VARCHAR(40),
    "shares_held" INTEGER,
    "admission_date" DATE NOT NULL,
    "cessation_date" DATE,
    "cessation_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "occupancies" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "status" "OccupancyStatus" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "note" VARCHAR(300),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "occupancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenancies" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "tenant_person_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "ended_on" DATE,
    "monthly_rent_paise" BIGINT,
    "deposit_paise" BIGINT,
    "police_intimation_ref" VARCHAR(60),
    "allowed_occupants" INTEGER,
    "bill_payer" "BillPayer" NOT NULL DEFAULT 'OWNER',
    "expiry_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "relation" VARCHAR(40) NOT NULL,
    "mobile" VARCHAR(10),
    "date_of_birth" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "plate" VARCHAR(15) NOT NULL,
    "type" "VehicleType" NOT NULL,
    "make" VARCHAR(60),
    "colour" VARCHAR(30),
    "owner_name" VARCHAR(100),
    "parking_slot_id" UUID,
    "sticker_no" VARCHAR(30),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "species" VARCHAR(30) NOT NULL,
    "breed" VARCHAR(60),
    "vaccinated_until" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominees" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "relation" VARCHAR(40) NOT NULL,
    "share_bps" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nominees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_approvals" (
    "id" UUID NOT NULL,
    "society_id" UUID NOT NULL,
    "unit_id" UUID,
    "kind" "ApprovalKind" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "summary" VARCHAR(200) NOT NULL,
    "requested_by" UUID NOT NULL,
    "decided_by" UUID,
    "decision_note" VARCHAR(300),
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "member_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "society_users_society_id_role_idx" ON "society_users"("society_id", "role");

-- CreateIndex
CREATE INDEX "society_users_society_id_unit_id_idx" ON "society_users"("society_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "society_users_society_id_user_id_key" ON "society_users"("society_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_templates_society_id_code_key" ON "permission_templates"("society_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_previous_hash_idx" ON "sessions"("previous_hash");

-- CreateIndex
CREATE INDEX "password_history_user_id_created_at_idx" ON "password_history"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "temp_passwords_user_id_used_at_idx" ON "temp_passwords"("user_id", "used_at");

-- CreateIndex
CREATE INDEX "login_attempts_ip_created_at_idx" ON "login_attempts"("ip", "created_at");

-- CreateIndex
CREATE INDEX "login_attempts_mobile_created_at_idx" ON "login_attempts"("mobile", "created_at");

-- CreateIndex
CREATE INDEX "auth_events_user_id_created_at_idx" ON "auth_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_society_id_created_at_idx" ON "audit_logs"("society_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_society_id_entity_entity_id_idx" ON "audit_logs"("society_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_created_at_idx" ON "idempotency_keys"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_key" ON "idempotency_keys"("user_id", "key");

-- CreateIndex
CREATE INDEX "outbound_messages_status_created_at_idx" ON "outbound_messages"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "societies_code_key" ON "societies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_society_id_name_key" ON "buildings"("society_id", "name");

-- CreateIndex
CREATE INDEX "units_society_id_building_id_idx" ON "units"("society_id", "building_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_building_id_number_key" ON "units"("building_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "parking_slots_society_id_code_key" ON "parking_slots"("society_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_society_id_account_number_ifsc_key" ON "bank_accounts"("society_id", "account_number", "ifsc");

-- CreateIndex
CREATE UNIQUE INDEX "billing_configs_society_id_key" ON "billing_configs"("society_id");

-- CreateIndex
CREATE UNIQUE INDEX "numbering_series_society_id_series_fy_key" ON "numbering_series"("society_id", "series", "fy");

-- CreateIndex
CREATE INDEX "statutory_config_key_society_id_effective_from_idx" ON "statutory_config"("key", "society_id", "effective_from");

-- CreateIndex
CREATE INDEX "import_jobs_society_id_created_at_idx" ON "import_jobs"("society_id", "created_at");

-- CreateIndex
CREATE INDEX "persons_society_id_mobile_idx" ON "persons"("society_id", "mobile");

-- CreateIndex
CREATE INDEX "persons_society_id_user_id_idx" ON "persons"("society_id", "user_id");

-- CreateIndex
CREATE INDEX "memberships_society_id_unit_id_cessation_date_idx" ON "memberships"("society_id", "unit_id", "cessation_date");

-- CreateIndex
CREATE INDEX "occupancies_society_id_unit_id_effective_from_idx" ON "occupancies"("society_id", "unit_id", "effective_from");

-- CreateIndex
CREATE INDEX "tenancies_society_id_unit_id_ended_on_idx" ON "tenancies"("society_id", "unit_id", "ended_on");

-- CreateIndex
CREATE INDEX "tenancies_end_date_ended_on_idx" ON "tenancies"("end_date", "ended_on");

-- CreateIndex
CREATE INDEX "family_members_society_id_unit_id_idx" ON "family_members"("society_id", "unit_id");

-- CreateIndex
CREATE INDEX "vehicles_society_id_plate_idx" ON "vehicles"("society_id", "plate");

-- CreateIndex
CREATE INDEX "vehicles_society_id_unit_id_idx" ON "vehicles"("society_id", "unit_id");

-- CreateIndex
CREATE INDEX "pets_society_id_unit_id_idx" ON "pets"("society_id", "unit_id");

-- CreateIndex
CREATE INDEX "nominees_society_id_membership_id_idx" ON "nominees"("society_id", "membership_id");

-- CreateIndex
CREATE INDEX "member_approvals_society_id_status_created_at_idx" ON "member_approvals"("society_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "society_users" ADD CONSTRAINT "society_users_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "society_users" ADD CONSTRAINT "society_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "society_users" ADD CONSTRAINT "society_users_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_templates" ADD CONSTRAINT "permission_templates_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temp_passwords" ADD CONSTRAINT "temp_passwords_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parking_slots" ADD CONSTRAINT "parking_slots_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_configs" ADD CONSTRAINT "billing_configs_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_society_id_fkey" FOREIGN KEY ("society_id") REFERENCES "societies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_person_id_fkey" FOREIGN KEY ("tenant_person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_parking_slot_id_fkey" FOREIGN KEY ("parking_slot_id") REFERENCES "parking_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominees" ADD CONSTRAINT "nominees_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_approvals" ADD CONSTRAINT "member_approvals_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
