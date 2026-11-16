-- Stage 3 · TEST ENVIRONMENT ONLY: standalone travel/activity metadata and record links.
-- NEVER apply to Production without separate migration review, encrypted DB backup,
-- tested recovery and explicit authorization.
CREATE TABLE IF NOT EXISTS public.finance_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 90),
  budget numeric(14,2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','finished')),
  started_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date,
  ended_on date,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_activity_budget_valid CHECK (budget IS NULL OR (budget > 0 AND budget <= 999999999999.99)),
  CONSTRAINT finance_activity_dates_valid CHECK (ended_on IS NULL OR ended_on >= started_on),
  CONSTRAINT finance_activity_finished_date CHECK ((status = 'finished') = (ended_on IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS finance_one_active_activity_per_user
  ON public.finance_activities(user_id) WHERE status='active';
CREATE INDEX IF NOT EXISTS finance_activities_owner_idx
  ON public.finance_activities(user_id,started_on DESC);

CREATE TABLE IF NOT EXISTS public.finance_activity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_id uuid NOT NULL REFERENCES public.finance_activities(id),
  record_id bigint NOT NULL REFERENCES public.records(id),
  removed_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_activity_link_unique UNIQUE (user_id,record_id)
);
CREATE INDEX IF NOT EXISTS finance_activity_links_owner_idx
  ON public.finance_activity_links(user_id,activity_id);

ALTER TABLE public.finance_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_activity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.finance_activities,public.finance_activity_links FROM anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.finance_activities,public.finance_activity_links TO authenticated;

CREATE POLICY finance_activities_owner_select ON public.finance_activities
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY finance_activities_owner_insert ON public.finance_activities
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid())=user_id);
CREATE POLICY finance_activities_owner_update ON public.finance_activities
  FOR UPDATE TO authenticated
  USING ((select auth.uid())=user_id)
  WITH CHECK ((select auth.uid())=user_id);

CREATE POLICY finance_activity_links_owner_select ON public.finance_activity_links
  FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
CREATE POLICY finance_activity_links_owner_insert ON public.finance_activity_links
  FOR INSERT TO authenticated WITH CHECK (
    (select auth.uid())=user_id
    AND EXISTS (
      SELECT 1 FROM public.records r
      WHERE r.id=record_id AND r.user_id=user_id
        AND r.type='expense' AND r.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.finance_activities a
      WHERE a.id=activity_id AND a.user_id=user_id
    )
  );
CREATE POLICY finance_activity_links_owner_update ON public.finance_activity_links
  FOR UPDATE TO authenticated
  USING ((select auth.uid())=user_id)
  WITH CHECK (
    (select auth.uid())=user_id
    AND EXISTS (
      SELECT 1 FROM public.records r
      WHERE r.id=record_id AND r.user_id=user_id AND r.type='expense'
    )
    AND EXISTS (
      SELECT 1 FROM public.finance_activities a
      WHERE a.id=activity_id AND a.user_id=user_id
    )
  );
-- No DELETE policy: unlink is soft-only (removed_at), finance rows never deleted.
