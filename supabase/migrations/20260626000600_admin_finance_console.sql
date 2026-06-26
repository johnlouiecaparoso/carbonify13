-- ============================================================================
-- Phase 5 — Admin finance console (read-only money overview for admins).
--
-- The ledger + reconcile_financials() are service-role only (the ledger is
-- deny-all to clients by design), so admins can't read them directly. These
-- SECURITY DEFINER RPCs run as the owner and self-gate on public.is_admin(),
-- exposing aggregate finance data to the admin UI without opening the ledger to
-- regular users. All read-only.
-- ============================================================================

-- Headline totals for the console summary cards.
create or replace function public.admin_finance_summary()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select json_build_object(
    'gross_sales', coalesce((
      select sum(total_amount) from public.credit_transactions where status = 'completed'), 0),
    'total_fees', coalesce((
      select sum(transaction_fee) from public.credit_transactions where status = 'completed'), 0),
    'transaction_count', (
      select count(*) from public.credit_transactions where status = 'completed'),
    'platform_revenue', coalesce((
      select balance from public.ledger_account_balances
      where account = 'platform_revenue' limit 1), 0),
    'pending_payouts', coalesce((
      select sum(amount) from public.payout_requests
      where status in ('requested', 'processing')), 0),
    'settled_payouts', coalesce((
      select sum(amount) from public.payout_requests where status = 'settled'), 0),
    'drift_count', (select count(*) from public.reconcile_financials())
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_finance_summary() from public, anon;
grant execute on function public.admin_finance_summary() to authenticated;

-- Recent transactions with buyer/seller names resolved.
create or replace function public.admin_recent_transactions(p_limit int default 50)
returns table (
  id uuid,
  created_at timestamptz,
  buyer_name text,
  seller_name text,
  quantity numeric,
  total_amount numeric,
  transaction_fee numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
    select
      ct.id,
      ct.created_at,
      coalesce(bp.full_name, 'Unknown'),
      coalesce(sp.full_name, 'Unknown'),
      ct.quantity,
      ct.total_amount,
      ct.transaction_fee,
      ct.status
    from public.credit_transactions ct
    left join public.profiles bp on bp.id = ct.buyer_id
    left join public.profiles sp on sp.id = ct.seller_id
    order by ct.created_at desc
    limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

revoke all on function public.admin_recent_transactions(int) from public, anon;
grant execute on function public.admin_recent_transactions(int) to authenticated;

-- Reconciliation drift report for admins (wraps the service-role function).
create or replace function public.admin_reconcile_financials()
returns table (issue_type text, ref_id text, detail text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query select * from public.reconcile_financials();
end;
$$;

revoke all on function public.admin_reconcile_financials() from public, anon;
grant execute on function public.admin_reconcile_financials() to authenticated;

notify pgrst, 'reload schema';
