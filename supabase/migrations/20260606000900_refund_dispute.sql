-- Phase 2.6 — Refunds & disputes.
--
-- Refunds NEVER edit original ledger rows; they post compensating entries that
-- reverse the purchase. Inventory is restored, ownership marked refunded, and
-- the credit_transactions row flipped to 'refunded'. Money is returned to
-- paymongo_clearing (the actual provider refund call is a separate step).

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.credit_transactions(id),
  raised_by uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved_refunded', 'resolved_rejected')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz
);
create index if not exists idx_disputes_txn on public.disputes(transaction_id);
create index if not exists idx_disputes_status on public.disputes(status, created_at);

alter table public.disputes enable row level security;
drop policy if exists disputes_select on public.disputes;
create policy disputes_select on public.disputes
  for select to authenticated
  using (raised_by = auth.uid() or public.is_admin());
drop policy if exists disputes_insert on public.disputes;
create policy disputes_insert on public.disputes
  for insert to authenticated
  with check (raised_by = auth.uid());

-- ---------------------------------------------------------------------------
-- refund_purchase — compensating reversal of a completed transaction.
-- Service-role/admin only. Idempotent (no-op if already refunded).
-- ---------------------------------------------------------------------------
create or replace function public.refund_purchase(p_transaction_id uuid, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn        public.credit_transactions%rowtype;
  v_hold       public.escrow_holds%rowtype;
  v_entry      uuid := gen_random_uuid();
  v_amount     numeric;
  v_fee        numeric;
  v_seller_net numeric;
  v_net_account text;
begin
  select * into v_txn from public.credit_transactions where id = p_transaction_id for update;
  if not found then raise exception 'transaction % not found', p_transaction_id; end if;
  if v_txn.status = 'refunded' then return; end if; -- idempotent

  v_amount := v_txn.total_amount;
  v_fee := coalesce(v_txn.transaction_fee, 0);
  v_seller_net := v_amount - v_fee;

  -- Source of the seller's funds: escrow if still held, else their balance.
  select * into v_hold from public.escrow_holds
    where transaction_id = v_txn.id order by created_at desc limit 1;

  if v_hold.id is not null and v_hold.status = 'held' then
    v_net_account := 'escrow_held';
    v_seller_net := v_hold.amount;
    update public.escrow_holds set status = 'refunded', refunded_at = now(), updated_at = now()
      where id = v_hold.id;
  else
    v_net_account := 'seller_payable:' || v_txn.seller_id::text;
  end if;

  -- Restore inventory.
  update public.project_credits
    set credits_available = credits_available + v_txn.quantity, updated_at = now()
    where id = v_txn.project_credit_id;
  update public.credit_listings
    set quantity = quantity + v_txn.quantity, updated_at = now()
    where id = v_txn.listing_id;

  -- Compensating ledger entries (reverse the purchase; cash back to clearing).
  insert into public.ledger_entries (entry_id, account, direction, amount, currency, ref_type, ref_id, description) values
    (v_entry, v_net_account, 'debit', v_seller_net, v_txn.currency, 'refund', v_txn.id::text, 'Refund - reverse seller proceeds'),
    (v_entry, 'paymongo_clearing', 'credit', v_amount, v_txn.currency, 'refund', v_txn.id::text, 'Refund - return to buyer');
  if v_fee > 0 then
    insert into public.ledger_entries (entry_id, account, direction, amount, currency, ref_type, ref_id, description)
      values (v_entry, 'platform_revenue', 'debit', v_fee, v_txn.currency, 'refund', v_txn.id::text, 'Refund - reverse platform fee');
  end if;

  -- Mark ownership + transaction refunded (no destructive edits to ledger).
  update public.credit_ownership
    set ownership_status = 'refunded', status = 'refunded', updated_at = now()
    where transaction_id = v_txn.id;
  update public.credit_transactions
    set status = 'refunded', updated_at = now()
    where id = v_txn.id;
end;
$$;

revoke all on function public.refund_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_purchase(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Dispute lifecycle.
-- ---------------------------------------------------------------------------
-- Buyer opens a dispute on their own transaction.
create or replace function public.open_dispute(p_transaction_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid;
  v_dispute_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select buyer_id into v_buyer from public.credit_transactions where id = p_transaction_id;
  if v_buyer is null then raise exception 'transaction not found'; end if;
  if v_buyer <> auth.uid() then raise exception 'only the buyer may dispute this transaction'; end if;

  insert into public.disputes (transaction_id, raised_by, reason)
    values (p_transaction_id, auth.uid(), p_reason)
    returning id into v_dispute_id;
  return v_dispute_id;
end;
$$;
grant execute on function public.open_dispute(uuid, text) to authenticated;

-- Admin resolves a dispute; refunding triggers the compensating reversal.
create or replace function public.resolve_dispute(p_dispute_id uuid, p_refund boolean, p_notes text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute public.disputes%rowtype;
begin
  if not public.is_admin() then raise exception 'only administrators can resolve disputes'; end if;

  select * into v_dispute from public.disputes where id = p_dispute_id for update;
  if not found then raise exception 'dispute % not found', p_dispute_id; end if;
  if v_dispute.status <> 'open' then return; end if; -- idempotent

  if p_refund then
    perform public.refund_purchase(v_dispute.transaction_id, p_notes);
  end if;

  update public.disputes
    set status = case when p_refund then 'resolved_refunded' else 'resolved_rejected' end,
        resolution_notes = p_notes,
        resolved_by = auth.uid(),
        resolved_at = now()
    where id = p_dispute_id;
end;
$$;
grant execute on function public.resolve_dispute(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
