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
