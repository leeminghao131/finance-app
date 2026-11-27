-- MH Finance App / isolated Supabase TEST project ONLY: qrkaxxdwqgffhkalvtby
-- Claims are NOT finance.records expenses, finance.records income or transfers.
-- Append-only cash outlays and owner-scoped repayments; only submitted_on,
-- cancelled_at (if never repaid) and repayment voided_at may be updated.
-- NEVER run on MH finance app Production without separate review + explicit approval.

create table public.finance_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  client_request_id uuid not null,
  title text not null check(length(btrim(title)) between 1 and 160),
  claimant text not null check(length(btrim(claimant)) between 1 and 160),
  amount numeric(14,2) not null check(amount>0 and amount<=9999999999.99),
  method text not null check(length(btrim(method)) between 1 and 120),
  paid_on date not null,
  note text not null default '' check(length(note)<=1000),
  submitted_on date,
  cancelled_at timestamptz,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  unique(user_id,client_request_id),
  check(submitted_on is null or submitted_on>=paid_on)
);

create table public.finance_claim_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  claim_id uuid not null,
  client_request_id uuid not null,
  amount numeric(14,2) not null check(amount>0 and amount<=9999999999.99),
  method text not null check(length(btrim(method)) between 1 and 120),
  received_on date not null,
  note text not null default '' check(length(note)<=1000),
  voided_at timestamptz,
  version bigint not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_claim_repayments_owner_fk foreign key (claim_id,user_id)
    references public.finance_claims(id,user_id) on delete restrict,
  unique(user_id,client_request_id)
);

create index finance_claims_owner_paid_idx on public.finance_claims(user_id,paid_on);
create index finance_claim_repayments_owner_claim_idx on public.finance_claim_repayments(user_id,claim_id);

alter table public.finance_claims enable row level security;
alter table public.finance_claim_repayments enable row level security;

create policy finance_claims_owner_select on public.finance_claims
  for select to authenticated using ((select auth.uid())=user_id);
create policy finance_claims_owner_insert on public.finance_claims
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy finance_claims_owner_update on public.finance_claims
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create policy finance_claim_repayments_owner_select on public.finance_claim_repayments
  for select to authenticated using ((select auth.uid())=user_id);
create policy finance_claim_repayments_owner_insert on public.finance_claim_repayments
  for insert to authenticated with check ((select auth.uid())=user_id);
create policy finance_claim_repayments_owner_update on public.finance_claim_repayments
  for update to authenticated using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

-- This guard handles direct API writes too, not just our React UI.
create function public.finance_guard_claim_row() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='INSERT' then
    if new.user_id is distinct from auth.uid() or new.submitted_on is not null
       or new.cancelled_at is not null or new.version<>1 then
      raise exception 'Invalid or unauthorised claim creation';
    end if;
    if new.paid_on>(now() at time zone 'Asia/Kuala_Lumpur')::date then
      raise exception 'Claim payment has not occurred yet';
    end if;
    new.created_at=now();new.updated_at=now();
    return new;
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id
     or new.client_request_id is distinct from old.client_request_id
     or new.title is distinct from old.title or new.claimant is distinct from old.claimant
     or new.amount is distinct from old.amount or new.method is distinct from old.method
     or new.paid_on is distinct from old.paid_on or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at
     or new.version is distinct from old.version then
    raise exception 'Claim identity, amounts and original details are immutable';
  end if;
  if old.cancelled_at is not null then raise exception 'Cancelled claim is immutable'; end if;
  if old.submitted_on is not null and new.submitted_on is distinct from old.submitted_on then
    raise exception 'Claim submission date cannot be edited';
  end if;
  if new.submitted_on is distinct from old.submitted_on and
     (new.submitted_on is null or new.submitted_on<old.paid_on or
      new.submitted_on>(now() at time zone 'Asia/Kuala_Lumpur')::date) then
    raise exception 'Invalid submitted date';
  end if;
  if new.cancelled_at is not null and old.cancelled_at is null then
    if exists(select 1 from public.finance_claim_repayments r
        where r.claim_id=old.id and r.voided_at is null) then
      raise exception 'A repaid claim cannot be cancelled; void the repayments first';
    end if;
    new.cancelled_at=now();
  end if;
  new.version=old.version+1;
  new.updated_at=now();
  return new;
end $$;
create trigger finance_claims_guard
  before insert or update on public.finance_claims
  for each row execute function public.finance_guard_claim_row();

-- Locks the parent claim in the SAME database transaction; two Android/Windows
-- devices can never both insert an overpayment based on a stale outstanding sum.
create function public.finance_guard_claim_repayment_row() returns trigger
language plpgsql security invoker set search_path='' as $$
declare c public.finance_claims%rowtype; existing numeric(14,2);
begin
  if TG_OP='UPDATE' then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id
       or new.claim_id is distinct from old.claim_id
       or new.client_request_id is distinct from old.client_request_id
       or new.amount is distinct from old.amount or new.method is distinct from old.method
       or new.received_on is distinct from old.received_on
       or new.note is distinct from old.note or new.created_at is distinct from old.created_at
       or new.version is distinct from old.version then
      raise exception 'Repayment money fields and ownership are immutable';
    end if;
    if old.voided_at is not null or new.voided_at is null then
      raise exception 'A voided repayment cannot be edited or restored silently';
    end if;
    new.voided_at=now();new.version=old.version+1;new.updated_at=now();
    return new;
  end if;
  if new.user_id is distinct from auth.uid() or new.voided_at is not null or new.version<>1 then
    raise exception 'Invalid or unauthorised repayment';
  end if;
  select * into c from public.finance_claims
    where id=new.claim_id and user_id=new.user_id for update;
  if not found or c.cancelled_at is not null then raise exception 'Claim not active or not owned'; end if;
  if new.received_on<c.paid_on or new.received_on>(now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'Invalid repayment date';
  end if;
  select coalesce(sum(r.amount),0) into existing
    from public.finance_claim_repayments r
    where r.claim_id=new.claim_id and r.user_id=new.user_id and r.voided_at is null;
  if existing+new.amount>c.amount then raise exception 'Repayment exceeds outstanding claim'; end if;
  new.created_at=now();new.updated_at=now();
  return new;
end $$;
create trigger finance_claim_repayments_guard
  before insert or update on public.finance_claim_repayments
  for each row execute function public.finance_guard_claim_repayment_row();

-- No permanent DELETE or unauthenticated access. No service_role client key.
revoke all on public.finance_claims from public,anon;
revoke all on public.finance_claim_repayments from public,anon;
grant select,insert,update on public.finance_claims to authenticated;
grant select,insert,update on public.finance_claim_repayments to authenticated;
revoke delete on public.finance_claims from authenticated;
revoke delete on public.finance_claim_repayments from authenticated;
revoke execute on function public.finance_guard_claim_row() from public,anon,authenticated;
revoke execute on function public.finance_guard_claim_repayment_row() from public,anon,authenticated;

-- Realtime only signals that an owned table changed; frontend reloads full
-- count-verified snapshots. Existing publication and tables stay unchanged.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='finance_claims') then
      alter publication supabase_realtime add table public.finance_claims;
    end if;
    if not exists(select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='finance_claim_repayments') then
      alter publication supabase_realtime add table public.finance_claim_repayments;
    end if;
  end if;
end $$;
