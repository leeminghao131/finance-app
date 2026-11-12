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
