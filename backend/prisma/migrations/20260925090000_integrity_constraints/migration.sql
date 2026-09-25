-- Rules the database enforces itself, so no code path — a bug, a script, a
-- console session — can break them. Prisma's schema language can't express
-- partial indexes, CHECK constraints or triggers; they live here.

-- MASTER_SPEC C3: exactly one primary owner per unit at a time.
CREATE UNIQUE INDEX "memberships_one_primary_per_unit"
  ON "memberships" ("unit_id") WHERE "kind" = 'PRIMARY' AND "cessation_date" IS NULL;

-- One open occupancy row and one open tenancy per unit (effective dating).
CREATE UNIQUE INDEX "occupancies_one_open_per_unit" ON "occupancies" ("unit_id") WHERE "effective_to" IS NULL;
CREATE UNIQUE INDEX "tenancies_one_open_per_unit" ON "tenancies" ("unit_id") WHERE "ended_on" IS NULL;

-- A plate is registered once per society among live vehicles; one person record per mobile per society.
CREATE UNIQUE INDEX "vehicles_plate_per_society" ON "vehicles" ("society_id", "plate") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "persons_mobile_per_society" ON "persons" ("society_id", "mobile") WHERE "deleted_at" IS NULL AND "mobile" IS NOT NULL;

ALTER TABLE "statutory_config" ADD CONSTRAINT "statutory_config_dates" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "occupancies" ADD CONSTRAINT "occupancies_dates" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_dates" CHECK ("end_date" > "start_date" AND ("ended_on" IS NULL OR "ended_on" >= "start_date"));
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_dates" CHECK ("cessation_date" IS NULL OR "cessation_date" >= "admission_date");
ALTER TABLE "nominees" ADD CONSTRAINT "nominees_share" CHECK ("share_bps" BETWEEN 1 AND 10000);
ALTER TABLE "billing_configs" ADD CONSTRAINT "billing_configs_interest" CHECK ("interest_rate_bps" >= 0);
ALTER TABLE "billing_configs" ADD CONSTRAINT "billing_configs_days" CHECK ("generation_day" BETWEEN 1 AND 28 AND "due_day" BETWEEN 1 AND 28);
ALTER TABLE "users" ADD CONSTRAINT "users_mobile_format" CHECK ("mobile" ~ '^[6-9][0-9]{9}$');

-- MASTER_SPEC E1: the audit log is append-only.
CREATE FUNCTION "forbid_audit_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$;
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_audit_mutation"();
