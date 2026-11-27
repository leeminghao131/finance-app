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
