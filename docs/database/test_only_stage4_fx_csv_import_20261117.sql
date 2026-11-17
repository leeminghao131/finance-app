-- TEST ONLY. Additive FX CSV RPC, does not replace existing import behavior.
CREATE OR REPLACE FUNCTION public.finance_import_fx_csv_rows(p_file_sha256 text, p_rows jsonb)
 RETURNS TABLE(source_row integer, import_status text, record_id bigint)
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
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
  v_fx_currency text;
  v_fx_amount numeric;
  v_fx_rate numeric;
  v_fx_rate_date text;
  v_fx_provider text;
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
    v_fx_currency := NULLIF(v_row->>'fx_currency','');
    v_fx_amount := NULL; v_fx_rate := NULL; v_fx_rate_date := NULL; v_fx_provider := NULL;
    IF v_fx_currency IS NOT NULL THEN
      IF v_fx_currency !~ '^[A-Z]{3}$' OR v_fx_currency = 'MYR' THEN
        RAISE EXCEPTION 'Invalid FX currency in CSV record';
      END IF;
      IF coalesce(v_row->>'fx_amount','') !~ '^[0-9]{1,12}(\.[0-9]{1,3})?$'
        OR coalesce(v_row->>'fx_rate','') !~ '^[0-9]{1,9}(\.[0-9]{1,12})?$' THEN
        RAISE EXCEPTION 'Invalid FX amount or reference rate';
      END IF;
      v_fx_amount := (v_row->>'fx_amount')::numeric;
      v_fx_rate := (v_row->>'fx_rate')::numeric;
      v_fx_rate_date := v_row->>'fx_rate_date';
      v_fx_provider := v_row->>'fx_provider';
      IF v_fx_amount <= 0 OR v_fx_rate <= 0 OR v_fx_rate_date IS NULL
         OR v_fx_rate_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         OR v_fx_rate_date > v_date OR v_fx_provider IS DISTINCT FROM 'frankfurter-v2'
         OR v_amount <> pg_catalog.round(v_fx_amount * v_fx_rate,2) THEN
        RAISE EXCEPTION 'FX reference metadata does not match MYR amount';
      END IF;
    ELSIF v_row ? 'fx_amount' OR v_row ? 'fx_rate' OR v_row ? 'fx_rate_date' OR v_row ? 'fx_provider' THEN
      RAISE EXCEPTION 'Incomplete FX reference metadata';
    END IF;

    v_marker_id := NULL;
    INSERT INTO public.finance_import_items(user_id, file_sha256, source_row)
    VALUES (v_user, p_file_sha256, v_source_row)
    ON CONFLICT ON CONSTRAINT finance_import_items_unique_source_row DO NOTHING
    RETURNING id INTO v_marker_id;

    IF v_marker_id IS NULL THEN
      SELECT fi.record_id INTO v_record_id FROM public.finance_import_items fi
      WHERE fi.user_id=v_user AND fi.file_sha256=p_file_sha256 AND fi.source_row=v_source_row;
      RETURN QUERY SELECT v_source_row, 'already_imported'::text, v_record_id;
      CONTINUE;
    END IF;

    INSERT INTO public.records (user_id, date, type, category, method, amount, note, fx_currency, fx_amount, fx_rate, fx_rate_date, fx_provider)
    VALUES (v_user, v_date, v_type, v_category, v_method, v_amount, v_note, v_fx_currency, v_fx_amount, v_fx_rate, v_fx_rate_date::date, v_fx_provider)
    RETURNING id INTO v_record_id;
    UPDATE public.finance_import_items fi SET record_id=v_record_id
    WHERE fi.id=v_marker_id AND fi.user_id=v_user;
    RETURN QUERY SELECT v_source_row, 'inserted'::text, v_record_id;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_import_fx_csv_rows(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_import_fx_csv_rows(text,jsonb) TO authenticated;
