-- ============================================================================
-- GATED CUTOVER SCRIPT — DO NOT RUN YET.
-- ============================================================================
-- Precondition: the marketplace + wallet UI must write money ONLY through the
-- server-authoritative flow (createMarketplaceCheckout -> paymongo-webhook ->
-- process_marketplace_purchase) and NO LONGER insert/update credit_transactions,
-- credit_ownership, or wallet_* directly from the browser.
--
-- Running this BEFORE that client migration WILL break live purchases/wallet
-- top-ups (the client writes will start failing RLS). This is the final Phase 1
-- step, performed during cutover. Tracked in docs/DEFERRED_BACKLOG.md.
--
-- Effect: make the financial tables server-write-only. We drop every
-- INSERT/UPDATE/DELETE RLS policy (the service role bypasses RLS, so the webhook
-- RPC keeps working) while keeping SELECT (read-your-own) policies intact.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('credit_transactions', 'credit_ownership', 'wallet_accounts', 'wallet_transactions')
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Keep RLS enabled so the now policy-less write paths are denied to clients.
alter table public.credit_transactions  enable row level security;
alter table public.credit_ownership      enable row level security;
alter table public.wallet_accounts       enable row level security;
alter table public.wallet_transactions   enable row level security;

-- Sanity check after running — should list only SELECT policies for these tables:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname='public'
--     and tablename in ('credit_transactions','credit_ownership','wallet_accounts','wallet_transactions')
--   order by tablename, cmd;
