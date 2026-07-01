-- ============================================================================
-- Admin refund console — client-callable, admin-gated refund wrapper.
--
-- refund_purchase() (20260606000900) is granted to service_role ONLY, so the
-- admin UI can't call it directly. This thin SECURITY DEFINER wrapper checks
-- is_admin() and then delegates to refund_purchase, letting an admin refund a
-- transaction from the Refunds console without a buyer-opened dispute.
--
-- The heavy lifting (compensating ledger entries, inventory restore, idempotent
-- no-op if already refunded) all still lives in refund_purchase — this only adds
-- the auth gate + a client grant. Idempotent create-or-replace; safe to re-run.
-- ============================================================================

create or replace function public.admin_refund_transaction(
  p_transaction_id uuid,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only administrators can issue refunds';
  end if;
  perform public.refund_purchase(p_transaction_id, p_reason);
end;
$$;

revoke all on function public.admin_refund_transaction(uuid, text) from public, anon;
grant execute on function public.admin_refund_transaction(uuid, text) to authenticated;

notify pgrst, 'reload schema';
