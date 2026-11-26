-- SYNTHETIC fake-only PR82 migration sanity checks. DO NOT run on Production.
DO $$
DECLARE tbl_count integer; rls_count integer;
BEGIN
  SELECT count(*) INTO tbl_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
      ('records','transfers','user_settings','monthly_budgets','finance_import_items',
       'finance_activities','finance_activity_links','finance_claims','finance_claim_repayments');
  SELECT count(*) INTO rls_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relrowsecurity AND c.relname IN
      ('records','transfers','user_settings','monthly_budgets','finance_import_items',
       'finance_activities','finance_activity_links','finance_claims','finance_claim_repayments');
  IF tbl_count<>9 OR rls_count<>9 THEN RAISE EXCEPTION 'Fake-only TEST table/RLS mismatch'; END IF;
  IF (SELECT count(*) FROM public.records)<>3 OR
     (SELECT count(*) FROM public.transfers)<>1 OR
     (SELECT count(*) FROM public.user_settings)<>2 THEN
    RAISE EXCEPTION 'Fake-only legacy records missing';
  END IF;
  IF (SELECT sum(amount) FROM public.records WHERE type='expense')<>124.55 OR
     (SELECT sum(amount) FROM public.records WHERE type='income')<>2500 OR
     (SELECT sum(amount) FROM public.transfers)<>50 THEN
    RAISE EXCEPTION 'Fake-only legacy amounts changed';
  END IF;
  IF (SELECT count(*) FROM public.records WHERE user_id='11111111-1111-4111-8111-111111111111')<>2 OR
     (SELECT count(*) FROM public.records WHERE user_id='22222222-2222-4222-8222-222222222222')<>1 THEN
    RAISE EXCEPTION 'Fake-only owner IDs changed';
  END IF;
  IF (SELECT category_budgets->>'饮食' FROM public.user_settings
      WHERE user_id='11111111-1111-4111-8111-111111111111') <> '300' THEN
    RAISE EXCEPTION 'Fake-only budget value changed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='records' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'Fake-only soft delete cutover has obsolete DELETE policy';
  END IF;
END $$;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.records)<>2 THEN
    RAISE EXCEPTION 'Fake user A cannot see exactly own two records';
  END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.records)<>1 THEN
    RAISE EXCEPTION 'Fake user B cannot see exactly own one record';
  END IF;
END $$;
ROLLBACK;
