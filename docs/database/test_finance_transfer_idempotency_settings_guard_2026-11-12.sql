-- TEST ONLY. Non-destructive security hardening.
-- Protect transfer retries with per-user unique request IDs.
-- Older transfers remain NULL and are NOT changed or removed.
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS finance_transfers_user_request_id_uniq
  ON public.transfers (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Prevent the browser's authenticated role from permanently deleting the
-- user's only settings row. No setting row is changed or removed.
-- All existing SELECT/INSERT/UPDATE owner policies remain as before.
REVOKE DELETE ON public.user_settings FROM authenticated;
