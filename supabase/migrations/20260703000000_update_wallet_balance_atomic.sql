-- ============================================================================
-- Missing-function backfill: update_wallet_balance_atomic
--
-- The paymongo-webhook credits a wallet top-up (Phase 1 P5, flow B) by calling
-- rpc('update_wallet_balance_atomic', { p_user_id, p_amount, p_operation }).
-- That function was never checked into supabase/migrations/ — it only ever
-- existed (if at all) as a hand-applied object in the live DB. On any DB where
-- it is absent the top-up webhook throws, 500s, leaves the event unprocessed,
-- and repeated failures cause PayMongo to auto-disable the webhook (the same
-- failure mode that blocked flow A on 2026-07-02).
--
-- This defines it idempotently (CREATE OR REPLACE) so applying migrations
-- guarantees flow B works, regardless of prior live state. Semantics match the
-- webhook's usage: adjust the caller-identified wallet's balance atomically and
-- return the new balance. It writes ONLY the balance — the webhook records the
-- wallet_transactions row separately, and top-ups intentionally write no ledger
-- (reconcile_financials scopes its ledger checks to marketplace-purchase
-- intents, so a top-up with no ledger entry does not trip it).
--
-- Server-authoritative: the only caller is the webhook (service_role). It
-- ensures the wallet exists first (mirrors ensure_wallet's defensive pattern)
-- and refuses to drive a balance negative.
-- ============================================================================

create or replace function public.update_wallet_balance_atomic(
  p_user_id uuid,
  p_amount numeric,
  p_operation text default 'add'
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallet_accounts%rowtype;
  v_delta  numeric;
  v_new    numeric;
begin
  if p_user_id is null then
    raise exception 'user id required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Normalize the operation to a signed delta.
  if p_operation in ('add', 'credit', 'deposit') then
    v_delta := p_amount;
  elsif p_operation in ('subtract', 'deduct', 'debit', 'withdraw') then
    v_delta := -p_amount;
  else
    raise exception 'unknown wallet operation: %', p_operation;
  end if;

  -- Ensure the wallet exists (defensive; the top-up UI already calls
  -- ensure_wallet, but the webhook must not depend on that ordering).
  if not exists (select 1 from public.wallet_accounts wa where wa.user_id = p_user_id) then
    begin
      insert into public.wallet_accounts (user_id, current_balance, currency)
        values (p_user_id, 0, 'PHP');
    exception when unique_violation then
      null;
    end;
  end if;

  -- Lock the row, apply the delta, guard against negatives.
  select * into v_wallet from public.wallet_accounts
    where user_id = p_user_id
    for update;
  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;

  v_new := coalesce(v_wallet.current_balance, 0) + v_delta;
  if v_new < 0 then
    raise exception 'insufficient wallet balance (% + % < 0)', coalesce(v_wallet.current_balance, 0), v_delta;
  end if;

  update public.wallet_accounts
    set current_balance = v_new, updated_at = now()
    where id = v_wallet.id;

  return v_new;
end;
$$;

-- Server-only: only the webhook (service_role) drives balances.
revoke all on function public.update_wallet_balance_atomic(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.update_wallet_balance_atomic(uuid, numeric, text) to service_role;

notify pgrst, 'reload schema';
