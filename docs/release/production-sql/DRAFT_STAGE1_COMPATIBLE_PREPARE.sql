-- DRAFT - DO NOT EXECUTE IN PRODUCTION WITHOUT SEPARATE OWNER APPROVAL.
-- Stage 1 only: transactionally ADD new objects and keep old DELETE policies intact.
-- This is reviewed SOURCE SQL from the 15 files listed below, with exactly 3
-- legacy DELETE privilege changes deferred to Stage 2.
-- Stop if unexpected schema, policy, or historical ledger values detected.
-- NO historical ledger INSERT/UPDATE/DELETE or data-copy statements.
BEGIN;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '8s';
DO $preflight$
BEGIN
  IF to_regclass('public.records') IS NULL OR
     to_regclass('public.transfers') IS NULL OR
     to_regclass('public.user_settings') IS NULL THEN
    RAISE EXCEPTION 'Production legacy business tables not found; stop';
  END IF;
  IF to_regclass('public.monthly_budgets') IS NOT NULL OR
     to_regclass('public.finance_claims') IS NOT NULL THEN
    RAISE EXCEPTION 'This is not the exact old 3-table schema; stop';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('records','transfers','user_settings')
        AND c.relrowsecurity) <> 3 THEN
    RAISE EXCEPTION 'Missing original RLS protection; stop';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('records','transfers','user_settings')) <> 12 THEN
    RAISE EXCEPTION 'Legacy policy count differs from 12; stop and review';
  END IF;
  IF EXISTS(SELECT 1 FROM public.records WHERE
       user_id IS NULL OR type NOT IN ('income','expense')
       OR amount IS NULL OR amount<=0 OR amount<>round(amount,2)
       OR category IS NULL OR length(btrim(category)) NOT BETWEEN 1 AND 100
       OR method IS NULL OR length(btrim(method)) NOT BETWEEN 1 AND 100
       OR date IS NULL OR date !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
  ) THEN
    RAISE EXCEPTION 'Legacy records incompatible with new constraints; stop';
  END IF;
END $preflight$;

-- SOURCE 1/15: docs/database/preview_finance_reliability.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- FINANCE APP: STAGING ONLY. Do not execute on production until owner authorizes.
-- Backwards compatible columns for optimistic concurrency + soft delete.
ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

ALTER TABLE public.records
  ADD CONSTRAINT finance_records_version_positive CHECK (version > 0);
ALTER TABLE public.user_settings
  ADD CONSTRAINT finance_settings_version_positive CHECK (version > 0);

CREATE INDEX IF NOT EXISTS finance_records_owner_id_idx ON public.records(user_id, id);
CREATE INDEX IF NOT EXISTS finance_records_owner_deleted_idx ON public.records(user_id, deleted_at, id);

-- The version is generated server-side, not trusted from the browser.
CREATE OR REPLACE FUNCTION public.finance_bump_record_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_records_revision
BEFORE UPDATE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_record_version();

CREATE OR REPLACE FUNCTION public.finance_bump_settings_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_settings_revision
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_settings_version();

-- Permanently deleting records from the browser is forbidden. Soft delete is UPDATE deleted_at.

-- Restrict changes to the signed-in owner as before (including restore).
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Realtime: only user-owned rows are exposed under RLS, never use browser service_role credentials.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transfers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;
END;
$$;


-- SOURCE 2/15: docs/database/preview_finance_transfers_budget_forecast.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- Copy of the pre-existing migration ALREADY applied to MH Finance Test.
-- Do not execute it twice; do not execute on production without separate consent and backup.
-- FINANCE APP PHASE 2 - TEST PROJECT ONLY. Do not apply to production without separate explicit approval and backup.
-- Old records and amounts are never rewritten.
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.transfers ADD CONSTRAINT finance_transfers_version_positive CHECK (version > 0);
CREATE INDEX IF NOT EXISTS finance_transfers_owner_deleted_idx ON public.transfers(user_id,deleted_at,date);

CREATE OR REPLACE FUNCTION public.finance_bump_transfer_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.version := OLD.version + 1;
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER finance_transfers_revision BEFORE UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_transfer_version();

-- Browser must never permanently delete a transfer; recycle bin updates deleted_at instead.

CREATE TABLE IF NOT EXISTS public.monthly_budgets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  category_budgets jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(category_budgets)='object'),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_budgets_pkey PRIMARY KEY (user_id,month)
);
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Monthly budgets: read owned" ON public.monthly_budgets
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Monthly budgets: insert owned" ON public.monthly_budgets
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Monthly budgets: update owned" ON public.monthly_budgets
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
GRANT SELECT, INSERT, UPDATE ON public.monthly_budgets TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_bump_month_budget_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.version := OLD.version + 1;
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER finance_monthly_budgets_revision BEFORE UPDATE ON public.monthly_budgets
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_month_budget_version();

-- Expected income is a plan, never an actual income/expense record.
ALTER TABLE public.user_settings
 ADD COLUMN IF NOT EXISTS forecast_plans jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.user_settings
 ADD CONSTRAINT finance_forecast_plans_array CHECK (jsonb_typeof(forecast_plans)='array');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='monthly_budgets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_budgets;
  END IF;
END;
$$;


-- SOURCE 3/15: docs/database/preview_finance_safe_csv_import.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- MH Finance App: Phase 3 staging-only NON-DESTRUCTIVE migration.
-- Adds metadata for idempotent CSV imports; it does NOT alter, delete, replace
-- or overwrite ANY existing finance record, transfer, budget or setting.
-- Do NOT run on Production without a separately approved backup + migration.

CREATE TABLE IF NOT EXISTS public.finance_import_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  source_row integer NOT NULL CHECK (source_row BETWEEN 2 AND 1000000),
  record_id bigint REFERENCES public.records(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_import_items_unique_source_row UNIQUE (user_id, file_sha256, source_row)
);
CREATE INDEX IF NOT EXISTS finance_import_items_user_source_idx
  ON public.finance_import_items(user_id, file_sha256);
CREATE INDEX IF NOT EXISTS finance_import_items_record_fk_idx
  ON public.finance_import_items(record_id);
ALTER TABLE public.finance_import_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_import_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.finance_import_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.finance_import_items_id_seq TO authenticated;

CREATE POLICY "Finance imports: owner can read own markers"
  ON public.finance_import_items FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Finance imports: owner can create own markers"
  ON public.finance_import_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Finance imports: owner can finalize own markers"
  ON public.finance_import_items FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- SECURITY INVOKER: all INSERT and UPDATE operations run under existing RLS
-- and cannot create records owned by another user. Each call is transactional:
-- either the full <=100-row chunk completes, or none of it commits.
CREATE OR REPLACE FUNCTION public.finance_import_csv_rows(
  p_file_sha256 text,
  p_rows jsonb
)
RETURNS TABLE (source_row integer, import_status text, record_id bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row jsonb;
  v_source_row integer;
  v_marker_id bigint;
  v_record_id bigint;
  v_amount_text text;
  v_amount numeric;
  v_date text;
  v_type text;
  v_category text;
  v_method text;
  v_note text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_file_sha256 IS NULL OR p_file_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid file SHA-256';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_rows) = 0
    OR jsonb_array_length(p_rows) > 100 THEN
    RAISE EXCEPTION 'Import chunk must contain 1 to 100 records';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    IF jsonb_typeof(v_row) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid CSV row';
    END IF;
    IF coalesce(v_row->>'source_row','') !~ '^[0-9]{1,7}$' THEN
      RAISE EXCEPTION 'Invalid source row number';
    END IF;
    v_source_row := (v_row->>'source_row')::integer;
    IF v_source_row < 2 OR v_source_row > 1000000 THEN
      RAISE EXCEPTION 'Source row outside allowed range';
    END IF;
    v_date := v_row->>'date';
    v_type := v_row->>'type';
    v_category := v_row->>'category';
    v_method := v_row->>'method';
    v_note := coalesce(v_row->>'note','');
    v_amount_text := v_row->>'amount';

    IF v_date IS NULL OR v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR pg_catalog.to_char(
        pg_catalog.make_date(
          pg_catalog.substring(v_date,1,4)::integer,
          pg_catalog.substring(v_date,6,2)::integer,
          pg_catalog.substring(v_date,9,2)::integer
        ), 'YYYY-MM-DD') <> v_date THEN
      RAISE EXCEPTION 'Invalid date in CSV record';
    END IF;
    IF v_type NOT IN ('income','expense') OR v_type IS NULL THEN
      RAISE EXCEPTION 'Invalid transaction type in CSV record';
    END IF;
    IF v_category IS NULL OR pg_catalog.length(v_category) NOT BETWEEN 1 AND 100
      OR v_method IS NULL OR pg_catalog.length(v_method) NOT BETWEEN 1 AND 100
      OR pg_catalog.length(v_note) > 2000 THEN
      RAISE EXCEPTION 'Invalid category, method or note length';
    END IF;
    IF v_amount_text IS NULL OR v_amount_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Invalid money value in CSV';
    END IF;
    v_amount := v_amount_text::numeric;
    IF v_amount <= 0 THEN RAISE EXCEPTION 'CSV money amount must be positive'; END IF;

    v_marker_id := NULL;
    INSERT INTO public.finance_import_items(user_id, file_sha256, source_row)
    VALUES (v_user, p_file_sha256, v_source_row)
    ON CONFLICT ON CONSTRAINT finance_import_items_unique_source_row DO NOTHING
    RETURNING id INTO v_marker_id;

    IF v_marker_id IS NULL THEN
      SELECT fi.record_id INTO v_record_id FROM public.finance_import_items fi
      WHERE fi.user_id=v_user AND fi.file_sha256=p_file_sha256 AND fi.source_row=v_source_row;
      RETURN QUERY SELECT v_source_row, 'already_imported'::text, v_record_id;
      CONTINUE;
    END IF;

    INSERT INTO public.records (user_id, date, type, category, method, amount, note)
    VALUES (v_user, v_date, v_type, v_category, v_method, v_amount, v_note)
    RETURNING id INTO v_record_id;
    UPDATE public.finance_import_items fi SET record_id=v_record_id
    WHERE fi.id=v_marker_id AND fi.user_id=v_user;
    RETURN QUERY SELECT v_source_row, 'inserted'::text, v_record_id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_import_csv_rows(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_import_csv_rows(text,jsonb) TO authenticated;


-- SOURCE 4/15: docs/database/preview_finance_opening_balances.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- REVIEWED PROPOSAL ONLY. Apply exclusively to isolated MH Finance Test first.
-- DO NOT apply to Production without separate explicit approval and verified backup.
-- Existing user_settings RLS owner policies and version trigger remain unchanged.
-- Additive nullable-free default: older accounts start with zero opening balances.
ALTER TABLE public.user_settings
 ADD COLUMN IF NOT EXISTS opening_balances jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_settings
 ADD CONSTRAINT finance_opening_balances_object CHECK (jsonb_typeof(opening_balances) = 'object');
-- Validate each key/value in application as MYR with at most two decimal places.
-- The existing user_settings version trigger protects optimistic updates.
-- Do not DROP this column for rollback if any user has entered balances:
-- revert the code first and preserve the stored values for later re-enable.


-- SOURCE 5/15: docs/database/test_finance_integrity_request_ids_2026-11-12.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- Staging-only, additive security migration. NEVER run on Production without
-- separately approved full backup, compatibility review and recovery plan.
-- Does not UPDATE, DELETE, TRUNCATE, or rewrite existing financial rows.
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS client_request_id uuid;

-- Legacy records have NULL; unique only for newly request-tagged records.
CREATE UNIQUE INDEX IF NOT EXISTS finance_records_user_request_id_uniq
  ON public.records (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- New INSERT/UPDATE records must satisfy ledger invariants.
-- NOT VALID deliberately avoids changing or validating historical rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.records'::regclass AND conname='finance_records_future_integrity'
  ) THEN
    ALTER TABLE public.records
      ADD CONSTRAINT finance_records_future_integrity
      CHECK (
        user_id IS NOT NULL
        AND type IN ('income','expense')
        AND amount IS NOT NULL AND amount > 0
        AND amount = round(amount,2)
        AND amount <= 999999999999.99
        AND category IS NOT NULL AND length(btrim(category)) BETWEEN 1 AND 100
        AND method IS NOT NULL AND length(btrim(method)) BETWEEN 1 AND 100
        AND date IS NOT NULL
        AND date ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      ) NOT VALID;
  END IF;
END $$;

-- Existing owner-scoped RLS policies remain unchanged. No new roles/grants.


-- SOURCE 6/15: docs/database/test_finance_transfer_idempotency_settings_guard_2026-11-12.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- TEST ONLY. Non-destructive security hardening.
-- Protect transfer retries with per-user unique request IDs.
-- Older transfers remain NULL and are NOT changed or removed.
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS finance_transfers_user_request_id_uniq
  ON public.transfers (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Prevent the browser's authenticated role from permanently deleting the
-- user's only settings row. No setting row is changed or removed.
-- All existing SELECT/INSERT/UPDATE owner policies remain as before.


-- SOURCE 7/15: docs/database/preview_finance_savings_goals.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- ISOLATED MH FINANCE TEST ONLY. Never run on Production without separate approval
-- and independently verified encrypted/restorable production backup.
-- Reuses existing public.user_settings owner RLS and server-side version trigger.
-- This is a new planning field only. Never touches actual records/transfers/budgets.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS savings_goals jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.user_settings
  ADD CONSTRAINT finance_savings_goals_array
  CHECK (jsonb_typeof(savings_goals) = 'array');
-- Previous versions that do not query savings_goals remain backward-compatible.
-- Safe rollback: revert application code and RETAIN column/data;
-- do not DROP the column if any user has entered goals.


-- SOURCE 8/15: docs/database/test_only_stage1_saved_filters.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- MH FINANCE TEST (qrkaxxdwqgffhkalvtby) ONLY. Not authorized for Production.
-- Additive, non-destructive saved search criteria. No old financial rows are modified.
-- Existing per-user user_settings RLS and version-increment optimistic concurrency apply.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS saved_filters jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='mh_finance_saved_filters_is_array'
      AND conrelid='public.user_settings'::regclass
  ) THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT mh_finance_saved_filters_is_array
      CHECK (jsonb_typeof(saved_filters)='array');
  END IF;
END $$;
-- Safe rollback on test: revert code only; retain the new column/data.
-- Production migration needs separate review, backup and explicit approval.


-- SOURCE 9/15: docs/database/test_only_stage2_bills_review_reconciliation.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- Stage 2 additive migration for isolated MH Finance Test ONLY (qrkaxxdwqgffhkalvtby).
-- Never apply this migration to Production without separate approval/backup/recovery review.
-- Existing records, transfers, budgets, logins, owner RLS, triggers and versions are preserved.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS recurring_bills jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS review_state jsonb NOT NULL DEFAULT '{"threshold":500,"decisions":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS account_checks jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='mh_finance_recurring_bills_array' AND conrelid='public.user_settings'::regclass) THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT mh_finance_recurring_bills_array CHECK (jsonb_typeof(recurring_bills)='array');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='mh_finance_review_state_object' AND conrelid='public.user_settings'::regclass) THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT mh_finance_review_state_object CHECK (jsonb_typeof(review_state)='object' AND jsonb_typeof(review_state->'decisions')='array');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='mh_finance_account_checks_array' AND conrelid='public.user_settings'::regclass) THEN
    ALTER TABLE public.user_settings ADD CONSTRAINT mh_finance_account_checks_array CHECK (jsonb_typeof(account_checks)='array');
  END IF;
END $$;
-- Rollback plan: revert code; leave additive Test columns/data for inspection.
-- Existing version-guarded updates and owner RLS reused, no new policies or tables.


-- SOURCE 10/15: docs/database/preview_finance_stage3_activities.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- Stage 3 · TEST ENVIRONMENT ONLY: standalone travel/activity metadata and record links.
-- NEVER apply to Production without separate migration review, encrypted DB backup,
-- tested recovery and explicit authorization.
CREATE TABLE IF NOT EXISTS public.finance_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 90),
  budget numeric(14,2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','finished')),
  started_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date,
  ended_on date,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_activity_budget_valid CHECK (budget IS NULL OR (budget > 0 AND budget <= 999999999999.99)),
  CONSTRAINT finance_activity_dates_valid CHECK (ended_on IS NULL OR ended_on >= started_on),
  CONSTRAINT finance_activity_finished_date CHECK ((status = 'finished') = (ended_on IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_one_active_activity_per_user
  ON public.finance_activities(user_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS finance_activities_owner_idx
  ON public.finance_activities(user_id,started_on DESC);

CREATE TABLE IF NOT EXISTS public.finance_activity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.finance_activities(id),
  record_id bigint NOT NULL REFERENCES public.records(id),
  removed_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_activity_link_unique UNIQUE (user_id,record_id)
);
CREATE INDEX IF NOT EXISTS finance_activity_links_owner_idx
  ON public.finance_activity_links(user_id,activity_id);

ALTER TABLE public.finance_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_activity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_activities,public.finance_activity_links FROM anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.finance_activities,public.finance_activity_links TO authenticated;

CREATE POLICY finance_activities_owner_select ON public.finance_activities
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY finance_activities_owner_insert ON public.finance_activities
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY finance_activities_owner_update ON public.finance_activities
  FOR UPDATE TO authenticated
  USING ((select auth.uid())=user_id)
  WITH CHECK ((select auth.uid())=user_id);

CREATE POLICY finance_activity_links_owner_select ON public.finance_activity_links
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY finance_activity_links_owner_insert ON public.finance_activity_links
  FOR INSERT TO authenticated WITH CHECK (
    (select auth.uid())=user_id
    AND EXISTS (
      SELECT 1 FROM public.records r
      WHERE r.id=public.finance_activity_links.record_id
        AND r.user_id=public.finance_activity_links.user_id
        AND r.type='expense' AND r.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.finance_activities a
      WHERE a.id=public.finance_activity_links.activity_id
        AND a.user_id=public.finance_activity_links.user_id
    )
  );
CREATE POLICY finance_activity_links_owner_update ON public.finance_activity_links
  FOR UPDATE TO authenticated
  USING ((select auth.uid())=user_id)
  WITH CHECK (
    (select auth.uid())=user_id
    AND EXISTS (
      SELECT 1 FROM public.records r
      WHERE r.id=public.finance_activity_links.record_id
        AND r.user_id=public.finance_activity_links.user_id
        AND (public.finance_activity_links.removed_at IS NOT NULL OR
          (r.type='expense' AND r.deleted_at IS NULL))
    )
    AND EXISTS (
      SELECT 1 FROM public.finance_activities a
      WHERE a.id=public.finance_activity_links.activity_id
        AND a.user_id=public.finance_activity_links.user_id
    )
  );
-- No DELETE policy: unlink is soft-only (removed_at), finance rows never deleted.


-- SOURCE 11/15: docs/database/preview_finance_stage3_rls_hardening.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- Stage 3 · TEST-ONLY non-destructive policy hardening.
-- Qualify owner relation inside nested RLS EXISTS to avoid a subquery name
-- resolving to itself, and permit soft-unlink when a previously linked Expense
-- has later been edited to Income. No rows, balances or policies are removed.
ALTER POLICY finance_activity_links_owner_insert ON public.finance_activity_links
WITH CHECK (
  (select auth.uid())=public.finance_activity_links.user_id
  AND EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.id=public.finance_activity_links.record_id
      AND r.user_id=public.finance_activity_links.user_id
      AND r.type='expense' AND r.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.finance_activities a
    WHERE a.id=public.finance_activity_links.activity_id
      AND a.user_id=public.finance_activity_links.user_id
  )
);
ALTER POLICY finance_activity_links_owner_update ON public.finance_activity_links
WITH CHECK (
  (select auth.uid())=public.finance_activity_links.user_id
  AND EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.id=public.finance_activity_links.record_id
      AND r.user_id=public.finance_activity_links.user_id
      AND (public.finance_activity_links.removed_at IS NOT NULL OR
          (r.type='expense' AND r.deleted_at IS NULL))
  )
  AND EXISTS (
    SELECT 1 FROM public.finance_activities a
    WHERE a.id=public.finance_activity_links.activity_id
      AND a.user_id=public.finance_activity_links.user_id
  )
);


-- SOURCE 12/15: docs/database/preview_finance_stage3_realtime.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- TEST-only Stage 3 Activity synchronization: notify clients of changes.
-- Existing financial tables are unaffected; this ONLY adds Stage 3 metadata tables.
-- Requires explicit separate Production approval before any future release.
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.finance_activities, public.finance_activity_links;


-- SOURCE 13/15: docs/database/test_only_stage4_fx_20261117.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- STAGE 4 / MH FINANCE TEST ONLY. NEVER apply to Production without separate approval.
-- Additive, nullable FX metadata. Existing MYR rows and amounts remain unchanged.
-- DB stores MYR amount as the existing financial source of truth; enforce consistency on FX rows.
ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS fx_currency text,
  ADD COLUMN IF NOT EXISTS fx_amount numeric(24,3),
  ADD COLUMN IF NOT EXISTS fx_rate numeric(24,12),
  ADD COLUMN IF NOT EXISTS fx_rate_date date,
  ADD COLUMN IF NOT EXISTS fx_provider text;

-- Do not touch legacy row values. Future FX rows must be complete, self-consistent,
-- and must not mutate MYR amount independently of original FX fields.
ALTER TABLE public.records
  ADD CONSTRAINT finance_records_fx_consistent CHECK (
    (fx_currency IS NULL AND fx_amount IS NULL AND fx_rate IS NULL
      AND fx_rate_date IS NULL AND fx_provider IS NULL)
    OR
    (fx_currency ~ '^[A-Z]{3}$' AND fx_currency <> 'MYR'
      AND fx_amount IS NOT NULL AND fx_amount > 0
      AND fx_rate IS NOT NULL AND fx_rate > 0
      AND fx_rate_date IS NOT NULL AND fx_rate_date::text <= date
      AND fx_provider = 'frankfurter-v2'
      AND amount = round(fx_amount * fx_rate,2))
  ) NOT VALID;

COMMENT ON COLUMN public.records.fx_currency IS 'Stage 4 reference FX original currency; NULL is legacy/normal MYR';
COMMENT ON COLUMN public.records.fx_rate IS 'Frankfurter v2 original-to-MYR frozen reference rate, not actual bank settlement';
-- Existing SELECT/INSERT/UPDATE owner RLS and row version trigger stay intact. No new policies, no UPDATE to old rows.


-- SOURCE 14/15: docs/database/test_only_stage4_fx_csv_import_20261117.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- TEST ONLY. Additive FX CSV RPC, does not replace existing import behavior.
CREATE OR REPLACE FUNCTION public.finance_import_fx_csv_rows(p_file_sha256 text, p_rows jsonb)
 RETURNS TABLE(source_row integer, import_status text, record_id bigint)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_row jsonb;
  v_source_row integer;
  v_marker_id bigint;
  v_record_id bigint;
  v_amount_text text;
  v_amount numeric;
  v_date text;
  v_type text;
  v_category text;
  v_method text;
  v_note text;
  v_fx_currency text;
  v_fx_amount numeric;
  v_fx_rate numeric;
  v_fx_rate_date text;
  v_fx_provider text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_file_sha256 IS NULL OR p_file_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid file SHA-256';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_rows) = 0
    OR jsonb_array_length(p_rows) > 100 THEN
    RAISE EXCEPTION 'Import chunk must contain 1 to 100 records';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    IF jsonb_typeof(v_row) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid CSV row';
    END IF;
    IF coalesce(v_row->>'source_row','') !~ '^[0-9]{1,7}$' THEN
      RAISE EXCEPTION 'Invalid source row number';
    END IF;
    v_source_row := (v_row->>'source_row')::integer;
    IF v_source_row < 2 OR v_source_row > 1000000 THEN
      RAISE EXCEPTION 'Source row outside allowed range';
    END IF;
    v_date := v_row->>'date';
    v_type := v_row->>'type';
    v_category := v_row->>'category';
    v_method := v_row->>'method';
    v_note := coalesce(v_row->>'note','');
    v_amount_text := v_row->>'amount';

    IF v_date IS NULL OR v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR pg_catalog.to_char(
        pg_catalog.make_date(
          pg_catalog.substring(v_date,1,4)::integer,
          pg_catalog.substring(v_date,6,2)::integer,
          pg_catalog.substring(v_date,9,2)::integer
        ), 'YYYY-MM-DD') <> v_date THEN
      RAISE EXCEPTION 'Invalid date in CSV record';
    END IF;
    IF v_type NOT IN ('income','expense') OR v_type IS NULL THEN
      RAISE EXCEPTION 'Invalid transaction type in CSV record';
    END IF;
    IF v_category IS NULL OR pg_catalog.length(v_category) NOT BETWEEN 1 AND 100
      OR v_method IS NULL OR pg_catalog.length(v_method) NOT BETWEEN 1 AND 100
      OR pg_catalog.length(v_note) > 2000 THEN
      RAISE EXCEPTION 'Invalid category, method or note length';
    END IF;
    IF v_amount_text IS NULL OR v_amount_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Invalid money value in CSV';
    END IF;
    v_amount := v_amount_text::numeric;
    IF v_amount <= 0 THEN RAISE EXCEPTION 'CSV money amount must be positive'; END IF;
    v_fx_currency := NULLIF(v_row->>'fx_currency','');
    v_fx_amount := NULL; v_fx_rate := NULL; v_fx_rate_date := NULL; v_fx_provider := NULL;
    IF v_fx_currency IS NOT NULL THEN
      IF v_fx_currency !~ '^[A-Z]{3}$' OR v_fx_currency = 'MYR' THEN
        RAISE EXCEPTION 'Invalid FX currency in CSV record';
      END IF;
      IF coalesce(v_row->>'fx_amount','') !~ '^[0-9]{1,12}(\.[0-9]{1,3})?$'
        OR coalesce(v_row->>'fx_rate','') !~ '^[0-9]{1,9}(\.[0-9]{1,12})?$' THEN
        RAISE EXCEPTION 'Invalid FX amount or reference rate';
      END IF;
      v_fx_amount := (v_row->>'fx_amount')::numeric;
      v_fx_rate := (v_row->>'fx_rate')::numeric;
      v_fx_rate_date := v_row->>'fx_rate_date';
      v_fx_provider := v_row->>'fx_provider';
      IF v_fx_amount <= 0 OR v_fx_rate <= 0 OR v_fx_rate_date IS NULL
         OR v_fx_rate_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         OR v_fx_rate_date > v_date OR v_fx_provider IS DISTINCT FROM 'frankfurter-v2'
         OR v_amount <> pg_catalog.round(v_fx_amount * v_fx_rate,2) THEN
        RAISE EXCEPTION 'FX reference metadata does not match MYR amount';
      END IF;
    ELSIF v_row ? 'fx_amount' OR v_row ? 'fx_rate' OR v_row ? 'fx_rate_date' OR v_row ? 'fx_provider' THEN
      RAISE EXCEPTION 'Incomplete FX reference metadata';
    END IF;

    v_marker_id := NULL;
    INSERT INTO public.finance_import_items(user_id, file_sha256, source_row)
    VALUES (v_user, p_file_sha256, v_source_row)
    ON CONFLICT ON CONSTRAINT finance_import_items_unique_source_row DO NOTHING
    RETURNING id INTO v_marker_id;

    IF v_marker_id IS NULL THEN
      SELECT fi.record_id INTO v_record_id FROM public.finance_import_items fi
      WHERE fi.user_id=v_user AND fi.file_sha256=p_file_sha256 AND fi.source_row=v_source_row;
      RETURN QUERY SELECT v_source_row, 'already_imported'::text, v_record_id;
      CONTINUE;
    END IF;

    INSERT INTO public.records (user_id, date, type, category, method, amount, note, fx_currency, fx_amount, fx_rate, fx_rate_date, fx_provider)
    VALUES (v_user, v_date, v_type, v_category, v_method, v_amount, v_note, v_fx_currency, v_fx_amount, v_fx_rate, v_fx_rate_date::date, v_fx_provider)
    RETURNING id INTO v_record_id;
    UPDATE public.finance_import_items fi SET record_id=v_record_id
    WHERE fi.id=v_marker_id AND fi.user_id=v_user;
    RETURN QUERY SELECT v_source_row, 'inserted'::text, v_record_id;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_import_fx_csv_rows(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_import_fx_csv_rows(text,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.finance_import_fx_csv_rows(text,jsonb) TO authenticated;


-- SOURCE 15/15: docs/database/test_only_claim_tracker_20261121.sql (unchanged except the 3 explicitly deferred legacy DELETE privilege operations)
-- MH Finance App / isolated Supabase TEST project ONLY: qrkaxxdwqgffhkalvtby
-- Claims are NOT finance.records expenses, finance.records income or transfers.
-- Append-only cash outlays and owner-scoped repayments; only submitted_on,
-- cancelled_at (if never repaid) and repayment voided_at may be updated.
-- NEVER run on MH finance app Production without separate review + explicit approval.

create table public.finance_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  client_request_id uuid not null,
  title text not null check(length(btrim(title)) between 1 and 160),
  claimant text not null check(length(btrim(claimant)) between 1 and 160),
  amount numeric(14,2) not null check(amount>0 and amount<=9999999999.99),
  method text not null check(length(btrim(method)) between 1 and 120),
  paid_on date not null,
  note text not null default '' check(length(note)<=1000),
  submitted_on date,
  cancelled_at timestamptz,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  unique(user_id,client_request_id),
  check(submitted_on is null or submitted_on>=paid_on)
);

create table public.finance_claim_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  claim_id uuid not null,
  client_request_id uuid not null,
  amount numeric(14,2) not null check(amount>0 and amount<=9999999999.99),
  method text not null check(length(btrim(method)) between 1 and 120),
  received_on date not null,
  note text not null default '' check(length(note)<=1000),
  voided_at timestamptz,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_claim_repayments_owner_fk foreign key (claim_id,user_id)
    references public.finance_claims(id,user_id) on delete restrict,
  unique(user_id,client_request_id)
);

create index finance_claims_owner_paid_idx on public.finance_claims(user_id,paid_on);
create index finance_claim_repayments_owner_claim_idx on public.finance_claim_repayments(user_id,claim_id);

alter table public.finance_claims enable row level security;
alter table public.finance_claim_repayments enable row level security;

create policy finance_claims_owner_select on public.finance_claims
  for select to authenticated using ((select auth.uid())=user_id);
create policy finance_claims_owner_insert on public.finance_claims
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy finance_claims_owner_update on public.finance_claims
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create policy finance_claim_repayments_owner_select on public.finance_claim_repayments
  for select to authenticated using ((select auth.uid())=user_id);
create policy finance_claim_repayments_owner_insert on public.finance_claim_repayments
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy finance_claim_repayments_owner_update on public.finance_claim_repayments
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

-- This guard handles direct API writes too, not just our React UI.
create function public.finance_guard_claim_row() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='INSERT' then
    if new.user_id is distinct from auth.uid() or new.submitted_on is not null
       or new.cancelled_at is not null or new.version<>1 then
      raise exception 'Invalid or unauthorised claim creation';
    end if;
    if new.paid_on>(now() at time zone 'Asia/Kuala_Lumpur')::date then
      raise exception 'Claim payment has not occurred yet';
    end if;
    new.created_at=now();new.updated_at=now();
    return new;
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.client_request_id is distinct from old.client_request_id
     or new.title is distinct from old.title or new.claimant is distinct from old.claimant
     or new.amount is distinct from old.amount or new.method is distinct from old.method
     or new.paid_on is distinct from old.paid_on or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at
     or new.version is distinct from old.version then
    raise exception 'Claim identity, amounts and original details are immutable';
  end if;
  if old.cancelled_at is not null then raise exception 'Cancelled claim is immutable'; end if;
  if old.submitted_on is not null and new.submitted_on is distinct from old.submitted_on then
    raise exception 'Claim submission date cannot be edited';
  end if;
  if new.submitted_on is distinct from old.submitted_on and
     (new.submitted_on is null or new.submitted_on<old.paid_on or
      new.submitted_on>(now() at time zone 'Asia/Kuala_Lumpur')::date) then
    raise exception 'Invalid submitted date';
  end if;
  if new.cancelled_at is not null and old.cancelled_at is null then
    if exists(select 1 from public.finance_claim_repayments r
        where r.claim_id=old.id and r.voided_at is null) then
      raise exception 'A repaid claim cannot be cancelled; void the repayments first';
    end if;
    new.cancelled_at=now();
  end if;
  new.version=old.version+1;
  new.updated_at=now();
  return new;
end $$;
create trigger finance_claims_guard
  before insert or update on public.finance_claims
  for each row execute function public.finance_guard_claim_row();

-- Locks the parent claim in the SAME database transaction; two Android/Windows
-- devices can never both insert an overpayment based on a stale outstanding sum.
create function public.finance_guard_claim_repayment_row() returns trigger
language plpgsql security invoker set search_path='' as $$
declare c public.finance_claims%rowtype; existing numeric(14,2);
begin
  if TG_OP='UPDATE' then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id
       or new.claim_id is distinct from old.claim_id
       or new.client_request_id is distinct from old.client_request_id
       or new.amount is distinct from old.amount or new.method is distinct from old.method
       or new.received_on is distinct from old.received_on
       or new.note is distinct from old.note or new.created_at is distinct from old.created_at
       or new.version is distinct from old.version then
      raise exception 'Repayment money fields and ownership are immutable';
    end if;
    if old.voided_at is not null or new.voided_at is null then
      raise exception 'A voided repayment cannot be edited or restored silently';
    end if;
    new.voided_at=now();new.version=old.version+1;new.updated_at=now();
    return new;
  end if;
  if new.user_id is distinct from auth.uid() or new.voided_at is not null or new.version<>1 then
    raise exception 'Invalid or unauthorised repayment';
  end if;
  select * into c from public.finance_claims
    where id=new.claim_id and user_id=new.user_id for update;
  if not found or c.cancelled_at is not null then raise exception 'Claim not active or not owned'; end if;
  if new.received_on<c.paid_on or new.received_on>(now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'Invalid repayment date';
  end if;
  select coalesce(sum(r.amount),0) into existing
    from public.finance_claim_repayments r
    where r.claim_id=new.claim_id and r.user_id=new.user_id and r.voided_at is null;
  if existing+new.amount>c.amount then raise exception 'Repayment exceeds outstanding claim'; end if;
  new.created_at=now();new.updated_at=now();
  return new;
end $$;
create trigger finance_claim_repayments_guard
  before insert or update on public.finance_claim_repayments
  for each row execute function public.finance_guard_claim_repayment_row();

-- No permanent DELETE or unauthenticated access. No service_role client key.
revoke all on public.finance_claims from public,anon;
revoke all on public.finance_claim_repayments from public,anon;
grant select,insert,update on public.finance_claims to authenticated;
grant select,insert,update on public.finance_claim_repayments to authenticated;
revoke delete on public.finance_claims from authenticated;
revoke delete on public.finance_claim_repayments from authenticated;
revoke execute on function public.finance_guard_claim_row() from public,anon,authenticated;
revoke execute on function public.finance_guard_claim_repayment_row() from public,anon,authenticated;

-- Realtime only signals that an owned table changed; frontend reloads full
-- count-verified snapshots. Existing publication and tables stay unchanged.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='finance_claims') then
      alter publication supabase_realtime add table public.finance_claims;
    end if;
    if not exists(select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='finance_claim_repayments') then
      alter publication supabase_realtime add table public.finance_claim_repayments;
    end if;
  end if;
end $$;

-- Preserve every legacy DELETE policy in Stage 1, so active old browsers
-- continue to use old code until a separately authorized cutover.
DO $compat$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename='records' AND cmd='DELETE') <> 1 OR
     (SELECT count(*) FROM pg_policies WHERE schemaname='public'
      AND tablename='transfers' AND cmd='DELETE') <> 1 OR
     NOT has_table_privilege('authenticated','public.user_settings','DELETE') THEN
    RAISE EXCEPTION 'Legacy browser DELETE contract changed during Stage 1; stop';
  END IF;
END $compat$;
COMMIT;
