-- Billing and payment rules the database enforces itself (MASTER_SPEC B3.11, C4, C5).

-- One live bill run per society per period.
CREATE UNIQUE INDEX "bill_runs_one_live_per_period" ON "bill_runs" ("society_id", "period") WHERE "status" <> 'DISCARDED';

-- Bill and credit-note numbers are unique within a society (gapless per FY comes from numbering_series).
CREATE UNIQUE INDEX "bills_number_per_society" ON "bills" ("society_id", "number") WHERE "number" IS NOT NULL;
CREATE UNIQUE INDEX "credit_notes_number_per_society" ON "credit_notes" ("society_id", "number");

ALTER TABLE "bills" ADD CONSTRAINT "bills_paid_within_bounds"
  CHECK ("principal_paid_paise" >= 0 AND "interest_paid_paise" >= 0
     AND "principal_paid_paise" <= "principal_paise" + "gst_paise" + "rounding_paise"
     AND "interest_paid_paise" <= "interest_paise");
ALTER TABLE "payments" ADD CONSTRAINT "payments_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_positive" CHECK ("amount_paise" > 0);
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_one_side"
  CHECK ("debit_paise" >= 0 AND "credit_paise" >= 0 AND ("debit_paise" = 0) <> ("credit_paise" = 0));

-- A published bill's charges, number and unit never change. Payment progress
-- and cancellation are the only updates allowed.
CREATE FUNCTION "guard_published_bill"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN RAISE EXCEPTION 'published bills are immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'DRAFT' AND (
       NEW.total_paise IS DISTINCT FROM OLD.total_paise OR NEW.principal_paise IS DISTINCT FROM OLD.principal_paise
    OR NEW.interest_paise IS DISTINCT FROM OLD.interest_paise OR NEW.gst_paise IS DISTINCT FROM OLD.gst_paise
    OR NEW.number IS DISTINCT FROM OLD.number OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
    OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.bill_date IS DISTINCT FROM OLD.bill_date
    OR (OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED')
    OR (NEW.status = 'DRAFT')) THEN
    RAISE EXCEPTION 'published bills are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "bills_immutable_once_published" BEFORE UPDATE OR DELETE ON "bills"
  FOR EACH ROW EXECUTE FUNCTION "guard_published_bill"();

CREATE FUNCTION "guard_published_bill_line"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM bills b WHERE b.id = COALESCE(OLD.bill_id, NEW.bill_id) AND b.status <> 'DRAFT') THEN
    RAISE EXCEPTION 'lines of a published bill are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER "bill_lines_immutable_once_published" BEFORE UPDATE OR DELETE ON "bill_lines"
  FOR EACH ROW EXECUTE FUNCTION "guard_published_bill_line"();

-- The ledger is append-only, like the audit log: corrections are new entries.
CREATE FUNCTION "forbid_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER "ledger_entries_append_only" BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
