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
