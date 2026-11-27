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
