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
