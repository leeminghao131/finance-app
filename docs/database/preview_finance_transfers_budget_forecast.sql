-- MH Finance App TEST DATABASE ONLY (qrkaxxdwqgffhkalvtby).
-- NEVER apply to production without separate backup, migration review and release permission.

-- Transfer versioned soft-delete. Historic transfers default to active version 1.
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.transfers ADD CONSTRAINT finance_transfers_version_positive CHECK(version > 0);
CREATE INDEX IF NOT EXISTS finance_transfers_user_deleted_date_idx ON public.transfers(user_id, deleted_at, date);

CREATE OR REPLACE FUNCTION public.finance_bump_transfer_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_transfers_revision BEFORE UPDATE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_transfer_version();

-- Prevent the browser from permanently deleting transfer rows.
DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;

-- A monthly budget is a saved historical snapshot. Default budgets still live
-- in user_settings.category_budgets and are never implicitly backfilled historically.
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL CHECK(month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  budgets jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(budgets) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
  PRIMARY KEY (user_id,month)
);

ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.monthly_budgets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.monthly_budgets TO authenticated;

CREATE POLICY "Owner can select monthly budgets" ON public.monthly_budgets
FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner can insert monthly budgets" ON public.monthly_budgets
FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Owner can update monthly budgets" ON public.monthly_budgets
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.finance_bump_monthly_budget_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_monthly_budget_revision BEFORE UPDATE ON public.monthly_budgets
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_monthly_budget_version();

-- Planned incomes are estimates only, never entries in records.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS forecast_expected_income jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Owner-filtered Postgres Change events are used as invalidation signals.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'monthly_budgets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_budgets;
  END IF;
END;
$$;
