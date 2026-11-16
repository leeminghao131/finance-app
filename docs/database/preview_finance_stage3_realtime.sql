-- TEST-only Stage 3 Activity synchronization: notify clients of changes.
-- Existing financial tables are unaffected; this ONLY adds Stage 3 metadata tables.
-- Requires explicit separate Production approval before any future release.
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.finance_activities, public.finance_activity_links;
