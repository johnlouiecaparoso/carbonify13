-- ============================================================================
-- P1 — External PSP settlement reconciliation (system-vs-PayMongo).
--
-- reconcile_financials() checks the system against ITSELF (intents vs
-- transactions vs ledger). This adds the missing EXTERNAL check: does our record
-- of each payment_intent match what PayMongo actually shows for that checkout
-- session? The comparison is done by the `paymongo-reconcile` edge function
-- (which can call the PayMongo API); this migration just provides the storage +
-- an admin-readable history.
--
-- Each run stores a summary + the list of discrepancies (JSONB). Discrepancy
-- types the edge function emits:
--   provider_paid_local_unsettled  — PayMongo shows paid, we never settled it
--                                     (a missed/failed webhook — the important one)
--   local_paid_provider_unpaid     — we marked it paid but PayMongo did not
--                                     (serious: fabricated/incorrect settlement)
--   amount_mismatch                — both paid but the amounts differ
--   provider_lookup_failed         — couldn't reach PayMongo for that session
-- ============================================================================

create table if not exists public.settlement_reconciliations (
  id                uuid primary key default gen_random_uuid(),
  run_at            timestamptz not null default now(),
  lookback_days     integer,
  checked_count     integer not null default 0,
  discrepancy_count integer not null default 0,
  discrepancies     jsonb   not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists idx_settlement_reconciliations_run_at
  on public.settlement_reconciliations (run_at desc);

-- Deny-all to clients; the edge function writes with the service role (bypasses
-- RLS), and admins read via the SECURITY DEFINER RPC below.
alter table public.settlement_reconciliations enable row level security;
revoke all on public.settlement_reconciliations from anon, authenticated;

-- Admin-readable history. Self-gates on is_admin() so it stays safe even though
-- it is SECURITY DEFINER (the underlying table remains deny-all to clients).
create or replace function public.admin_recent_settlement_reconciliations(p_limit int default 20)
returns setof public.settlement_reconciliations
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.settlement_reconciliations
  where public.is_admin()
  order by run_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.admin_recent_settlement_reconciliations(int) from public, anon;
grant execute on function public.admin_recent_settlement_reconciliations(int) to authenticated;

notify pgrst, 'reload schema';
