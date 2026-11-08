-- FINANCE APP: STAGING ONLY. Do not execute on production until owner authorizes.
-- Backwards compatible columns for optimistic concurrency + soft delete.
ALTER TABLE public.records
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

ALTER TABLE public.records
  ADD CONSTRAINT finance_records_version_positive CHECK (version > 0);
ALTER TABLE public.user_settings
  ADD CONSTRAINT finance_settings_version_positive CHECK (version > 0);

CREATE INDEX IF NOT EXISTS finance_records_owner_id_idx ON public.records(user_id, id);
CREATE INDEX IF NOT EXISTS finance_records_owner_deleted_idx ON public.records(user_id, deleted_at, id);

-- The version is generated server-side, not trusted from the browser.
CREATE OR REPLACE FUNCTION public.finance_bump_record_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_records_revision
BEFORE UPDATE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_record_version();

CREATE OR REPLACE FUNCTION public.finance_bump_settings_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_settings_revision
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.finance_bump_settings_version();

-- Permanently deleting records from the browser is forbidden. Soft delete is UPDATE deleted_at.
DROP POLICY IF EXISTS "Users can delete own records" ON public.records;

-- Restrict changes to the signed-in owner as before (including restore).
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Realtime: only user-owned rows are exposed under RLS, never use browser service_role credentials.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transfers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  END IF;
END;
$$;
