-- Stage 3 · TEST-ONLY non-destructive policy hardening.
-- Qualify owner relation inside nested RLS EXISTS to avoid a subquery name
-- resolving to itself, and permit soft-unlink when a previously linked Expense
-- has later been edited to Income. No rows, balances or policies are removed.
ALTER POLICY finance_activity_links_owner_insert ON public.finance_activity_links
WITH CHECK (
  (select auth.uid())=public.finance_activity_links.user_id
  AND EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.id=public.finance_activity_links.record_id
      AND r.user_id=public.finance_activity_links.user_id
      AND r.type='expense' AND r.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.finance_activities a
    WHERE a.id=public.finance_activity_links.activity_id
      AND a.user_id=public.finance_activity_links.user_id
  )
);
ALTER POLICY finance_activity_links_owner_update ON public.finance_activity_links
WITH CHECK (
  (select auth.uid())=public.finance_activity_links.user_id
  AND EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.id=public.finance_activity_links.record_id
      AND r.user_id=public.finance_activity_links.user_id
      AND (public.finance_activity_links.removed_at IS NOT NULL OR
          (r.type='expense' AND r.deleted_at IS NULL))
  )
  AND EXISTS (
    SELECT 1 FROM public.finance_activities a
    WHERE a.id=public.finance_activity_links.activity_id
      AND a.user_id=public.finance_activity_links.user_id
  )
);
