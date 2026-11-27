-- DRAFT - DO NOT RUN without SEPARATE, EXPLICIT OWNER APPROVAL.
-- STAGE 2: coordinate with new code release; old web sessions will no longer
-- be allowed permanent DELETE; versioned soft-delete clients should use UPDATE.
-- Never run until fresh backup + verified Stage 1, RLS and release cutover plan.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '8s';
DO $ready$
BEGIN
  IF to_regclass('public.monthly_budgets') IS NULL OR
     to_regclass('public.finance_claims') IS NULL OR
     to_regclass('public.finance_claim_repayments') IS NULL OR
     to_regclass('public.finance_activities') IS NULL OR
     to_regclass('public.finance_activity_links') IS NULL OR
     to_regclass('public.finance_import_items') IS NULL THEN
    RAISE EXCEPTION 'Stage 1 objects are missing; refuse cutover';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.records'::regclass
    AND attname='deleted_at' AND NOT attisdropped) OR
     NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.transfers'::regclass
    AND attname='deleted_at' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Soft-delete columns are missing';
  END IF;
END $ready$;
-- These are EXACTLY the three operations deferred from Stage 1:
DROP POLICY IF EXISTS "Users can delete own records" ON public.records;
DROP POLICY IF EXISTS "Users can delete own transfers" ON public.transfers;
REVOKE DELETE ON public.user_settings FROM authenticated;
-- Verify the new soft-delete contract.
DO $verify$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename IN ('records','transfers') AND cmd='DELETE')
   OR has_table_privilege('authenticated','public.user_settings','DELETE') THEN
   RAISE EXCEPTION 'Old hard-delete contract was not fully removed';
 END IF;
END $verify$;
COMMIT;
