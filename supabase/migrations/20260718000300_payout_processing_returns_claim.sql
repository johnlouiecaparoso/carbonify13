-- ============================================================================
-- M1 fix: mark_payout_processing must report whether it actually claimed the row.
--
-- The process-payouts worker SELECTs status='requested' rows, calls
-- mark_payout_processing (which transitions requested -> processing), then
-- disburses. mark_payout_processing returned void, so the worker disbursed
-- unconditionally. Two overlapping runs (cron overlap) can both SELECT the same
-- row; both call the RPC; both disburse -> DOUBLE PAYOUT once a real provider is
-- wired. The requested->processing transition is already atomic (WHERE ...
-- status='requested'); the missing piece is returning whether THIS call won it.
--
-- Now returns boolean: true only when this call transitioned the row. The worker
-- must skip disbursement when it gets false.
-- ============================================================================

drop function if exists public.mark_payout_processing(uuid);

create or replace function public.mark_payout_processing(p_payout_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.payout_requests
    set status = 'processing', attempts = attempts + 1, updated_at = now()
    where id = p_payout_id and status = 'requested';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.mark_payout_processing(uuid) from public, anon, authenticated;
grant execute on function public.mark_payout_processing(uuid) to service_role;

notify pgrst, 'reload schema';
