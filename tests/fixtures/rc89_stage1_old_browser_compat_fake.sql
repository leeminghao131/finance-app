-- FAKE USERS ONLY. Execute only against disposable CI local PostgreSQL after draft Stage 1.
-- All writes are inside an explicit transaction that MUST be rolled back.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
-- Old client must still create, edit, and remove its own ledger entries during Stage 1.
INSERT INTO public.records(user_id,type,amount,category,method,note,date)
VALUES ('11111111-1111-4111-8111-111111111111','expense',100.00,'饮食','TNG','old-client-fake','2026-11-24');
UPDATE public.records SET note='old-client-edited' WHERE id=1;
DO $assert$
BEGIN
 IF (SELECT version FROM public.records WHERE id=1) < 2 THEN
   RAISE EXCEPTION 'Old-record UPDATE did not work with new revision trigger';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.records WHERE note='old-client-fake' AND amount=100.00) THEN
   RAISE EXCEPTION 'Old-record INSERT failed';
 END IF;
END $assert$;
DELETE FROM public.records WHERE id=1;
DO $assert$
BEGIN
 IF EXISTS (SELECT 1 FROM public.records WHERE id=1) THEN
   RAISE EXCEPTION 'Old browser hard-delete policy unexpectedly broken during Stage 1';
 END IF;
END $assert$;
-- Existing settings template must remain editable by its original owner.
UPDATE public.user_settings
 SET category_budgets = '{"饮食":350}'::jsonb
 WHERE user_id='11111111-1111-4111-8111-111111111111';
DO $assert$
BEGIN
 IF (SELECT category_budgets->>'饮食' FROM public.user_settings
      WHERE user_id='11111111-1111-4111-8111-111111111111') <> '350' THEN
   RAISE EXCEPTION 'Old monthly budget template update failed';
 END IF;
END $assert$;
-- Old transfer create, update, and delete must still operate during Stage 1.
INSERT INTO public.transfers(user_id,from_method,to_method,amount,note,date)
VALUES ('11111111-1111-4111-8111-111111111111','TNG','BANK',25.00,'old-client-transfer','2026-11-24');
UPDATE public.transfers SET note='old-transfer-edited' WHERE note='old-client-transfer';
DELETE FROM public.transfers WHERE note='old-transfer-edited';
DO $assert$
BEGIN
 IF EXISTS (SELECT 1 FROM public.transfers WHERE note='old-transfer-edited') THEN
    RAISE EXCEPTION 'Old transfer hard-delete policy unexpectedly broken during Stage 1';
 END IF;
END $assert$;
ROLLBACK;

-- Verify that the rolled-back operations left every fake money entry intact.
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.records) <> 3 OR
    (SELECT sum(amount) FROM public.records WHERE type='expense') <> 124.55 OR
    (SELECT count(*) FROM public.transfers) <> 1 OR
    (SELECT sum(amount) FROM public.transfers) <> 50 OR
    (SELECT category_budgets->>'饮食' FROM public.user_settings
     WHERE user_id='11111111-1111-4111-8111-111111111111') <> '300' THEN
   RAISE EXCEPTION 'Stage 1 regression test modified data despite ROLLBACK';
 END IF;
END $assert$;
