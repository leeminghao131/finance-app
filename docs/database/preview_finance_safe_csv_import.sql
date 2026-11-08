-- MH Finance App: Phase 3 staging-only NON-DESTRUCTIVE migration.
-- Adds metadata for idempotent CSV imports; it does NOT alter, delete, replace
-- or overwrite ANY existing finance record, transfer, budget or setting.
-- Do NOT run on Production without a separately approved backup + migration.

CREATE TABLE IF NOT EXISTS public.finance_import_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  source_row integer NOT NULL CHECK (source_row BETWEEN 2 AND 1000000),
  record_id bigint REFERENCES public.records(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_import_items_unique_source_row UNIQUE (user_id, file_sha256, source_row)
);
CREATE INDEX IF NOT EXISTS finance_import_items_user_source_idx
  ON public.finance_import_items(user_id, file_sha256);
ALTER TABLE public.finance_import_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_import_items FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.finance_import_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.finance_import_items_id_seq TO authenticated;

CREATE POLICY "Finance imports: owner can read own markers"
  ON public.finance_import_items FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Finance imports: owner can create own markers"
  ON public.finance_import_items FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Finance imports: owner can finalize own markers"
  ON public.finance_import_items FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- SECURITY INVOKER: all INSERT and UPDATE operations run under existing RLS
-- and cannot create records owned by another user. Each call is transactional:
-- either the full <=100-row chunk completes, or none of it commits.
CREATE OR REPLACE FUNCTION public.finance_import_csv_rows(
  p_file_sha256 text,
  p_rows jsonb
)
RETURNS TABLE (source_row integer, import_status text, record_id bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row jsonb;
  v_source_row integer;
  v_marker_id bigint;
  v_record_id bigint;
  v_amount_text text;
  v_amount numeric;
  v_date text;
  v_type text;
  v_category text;
  v_method text;
  v_note text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_file_sha256 IS NULL OR p_file_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid file SHA-256';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_rows) = 0
    OR jsonb_array_length(p_rows) > 100 THEN
    RAISE EXCEPTION 'Import chunk must contain 1 to 100 records';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    IF jsonb_typeof(v_row) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid CSV row';
    END IF;
    IF coalesce(v_row->>'source_row','') !~ '^[0-9]{1,7}$' THEN
      RAISE EXCEPTION 'Invalid source row number';
    END IF;
    v_source_row := (v_row->>'source_row')::integer;
    IF v_source_row < 2 OR v_source_row > 1000000 THEN
      RAISE EXCEPTION 'Source row outside allowed range';
    END IF;
    v_date := v_row->>'date';
    v_type := v_row->>'type';
    v_category := v_row->>'category';
    v_method := v_row->>'method';
    v_note := coalesce(v_row->>'note','');
    v_amount_text := v_row->>'amount';

    IF v_date IS NULL OR v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR pg_catalog.to_char(
        pg_catalog.make_date(
          pg_catalog.substring(v_date,1,4)::integer,
          pg_catalog.substring(v_date,6,2)::integer,
          pg_catalog.substring(v_date,9,2)::integer
        ), 'YYYY-MM-DD') <> v_date THEN
      RAISE EXCEPTION 'Invalid date in CSV record';
    END IF;
    IF v_type NOT IN ('income','expense') OR v_type IS NULL THEN
      RAISE EXCEPTION 'Invalid transaction type in CSV record';
    END IF;
    IF v_category IS NULL OR pg_catalog.length(v_category) NOT BETWEEN 1 AND 100
      OR v_method IS NULL OR pg_catalog.length(v_method) NOT BETWEEN 1 AND 100
      OR pg_catalog.length(v_note) > 2000 THEN
      RAISE EXCEPTION 'Invalid category, method or note length';
    END IF;
    IF v_amount_text IS NULL OR v_amount_text !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Invalid money value in CSV';
    END IF;
    v_amount := v_amount_text::numeric;
    IF v_amount <= 0 THEN RAISE EXCEPTION 'CSV money amount must be positive'; END IF;

    v_marker_id := NULL;
    INSERT INTO public.finance_import_items(user_id, file_sha256, source_row)
    VALUES (v_user, p_file_sha256, v_source_row)
    ON CONFLICT (user_id, file_sha256, source_row) DO NOTHING
    RETURNING id INTO v_marker_id;

    IF v_marker_id IS NULL THEN
      SELECT fi.record_id INTO v_record_id FROM public.finance_import_items fi
      WHERE fi.user_id=v_user AND fi.file_sha256=p_file_sha256 AND fi.source_row=v_source_row;
      RETURN QUERY SELECT v_source_row, 'already_imported'::text, v_record_id;
      CONTINUE;
    END IF;

    INSERT INTO public.records (user_id, date, type, category, method, amount, note)
    VALUES (v_user, v_date, v_type, v_category, v_method, v_amount, v_note)
    RETURNING id INTO v_record_id;
    UPDATE public.finance_import_items fi SET record_id=v_record_id
    WHERE fi.id=v_marker_id AND fi.user_id=v_user;
    RETURN QUERY SELECT v_source_row, 'inserted'::text, v_record_id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_import_csv_rows(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_import_csv_rows(text,jsonb) TO authenticated;
