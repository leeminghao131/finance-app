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
DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;

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
