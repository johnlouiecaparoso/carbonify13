-- Phase 1 P2 cutover — server-side wallet creation.
--
-- The app auto-creates a wallet_accounts row the first time a user opens their
-- wallet (or tops up). That was a browser INSERT, which the financial-table RLS
-- lockdown (supabase/cutover/lockdown_financial_writes.sql) removes — so wallet
-- creation must move server-side first, or new users can't get a wallet after
-- the lockdown.
--
-- ensure_wallet() is SECURITY DEFINER and derives the user from auth.uid(), so
-- it bypasses the (write-locked) RLS and can only ever create the caller's own
-- wallet. Idempotent: returns the existing wallet if there already is one.

create or replace function public.ensure_wallet()
returns table(id uuid, user_id uuid, current_balance numeric, currency text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if not exists (select 1 from public.wallet_accounts wa where wa.user_id = v_user) then
    begin
      insert into public.wallet_accounts (user_id, current_balance, currency)
        values (v_user, 0, 'PHP');
    exception when unique_violation then
      -- A concurrent request created it first; fall through and return that row.
      null;
    end;
  end if;

  return query
    select wa.id, wa.user_id, wa.current_balance, wa.currency
    from public.wallet_accounts wa
    where wa.user_id = v_user;
end;
$$;

revoke all on function public.ensure_wallet() from public, anon;
grant execute on function public.ensure_wallet() to authenticated, service_role;

notify pgrst, 'reload schema';
