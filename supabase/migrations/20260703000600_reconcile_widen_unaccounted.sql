-- ============================================================================
-- P7 hardening — widen reconcile_financials() so fabricated / legacy completed
-- transactions can't hide.
--
-- The original report only flagged intent-backed transactions that were missing
-- a ledger group (check #2). A completed credit_transactions row that went
-- through NEITHER settlement RPC — e.g. a row written directly by a client
-- before the RLS lockdown, or a fabricated row — matched none of the checks and
-- stayed invisible.
--
-- This is a full CREATE OR REPLACE identical to 20260606000500's definition with
-- ONE added check (#6): a 'completed' transaction that has neither a matching
-- payment_intent (card/online path) NOR any purchase ledger group (wallet path
-- also writes ledger entries keyed on the transaction id) is reported as
-- 'transaction_unaccounted'.
--
-- NOTE: legitimate settlements are never flagged — card purchases have a
-- payment_intent; wallet purchases have a balanced ledger group. If this surfaces
-- rows after applying, they are PRE-EXISTING legacy/direct-write transactions
-- worth reviewing (that is the point) — not a regression from this change.
-- ============================================================================

create or replace function public.reconcile_financials(p_stuck_minutes int default 60)
returns table(issue_type text, ref_id text, detail text)
language sql
stable
security definer
set search_path = public
as $$
  -- 1) Paid intents that never produced a settling transaction.
  select 'paid_intent_no_transaction', pi.id::text,
         format('intent paid (amount %s) but no credit_transactions row', pi.amount)
  from public.payment_intents pi
  where pi.status = 'paid'
    and pi.purpose = 'marketplace_purchase'
    and not exists (
      select 1 from public.credit_transactions ct where ct.payment_reference = pi.id::text
    )

  union all
  -- 2) NEW-FLOW completed transactions with no ledger entry group.
  select 'transaction_no_ledger', ct.id::text,
         'completed transaction has no ledger_entries'
  from public.credit_transactions ct
  where ct.status = 'completed'
    and exists (
      select 1 from public.payment_intents pi where pi.id::text = ct.payment_reference
    )
    and not exists (
      select 1 from public.ledger_entries le
      where le.ref_type = 'purchase' and le.ref_id = ct.id::text
    )

  union all
  -- 3) Ledger groups whose debits != credits (should be impossible; safety net).
  select 'ledger_imbalance', le.entry_id::text,
         format('debits-credits = %s', sum(case when direction = 'debit' then amount else -amount end))
  from public.ledger_entries le
  group by le.entry_id
  having sum(case when direction = 'debit' then amount else -amount end) <> 0

  union all
  -- 4) Webhook events stuck unprocessed beyond the threshold.
  select 'webhook_stuck', we.event_id,
         format('received %s, still %s', we.received_at, we.status)
  from public.webhook_events we
  where we.status <> 'processed'
    and we.received_at < now() - make_interval(mins => p_stuck_minutes)

  union all
  -- 5) Paid intent amount vs settled ledger debit mismatch.
  select 'intent_ledger_amount_mismatch', pi.id::text,
         format('intent %s vs ledger debit %s', pi.amount, coalesce(led.total, 0))
  from public.payment_intents pi
  join public.credit_transactions ct on ct.payment_reference = pi.id::text
  left join (
    select ref_id, sum(amount) as total
    from public.ledger_entries
    where ref_type = 'purchase' and direction = 'debit'
    group by ref_id
  ) led on led.ref_id = ct.id::text
  where pi.status = 'paid' and coalesce(led.total, 0) <> pi.amount

  union all
  -- 6) P7 — completed transactions that went through NEITHER settlement path:
  --    no payment_intent (card/online) AND no purchase ledger group (wallet).
  --    Catches direct-write / fabricated / pre-lockdown legacy rows.
  select 'transaction_unaccounted', ct.id::text,
         format('completed transaction (amount %s) has neither a payment_intent nor a ledger group',
                coalesce(ct.total_amount, 0))
  from public.credit_transactions ct
  where ct.status = 'completed'
    and not exists (
      select 1 from public.payment_intents pi where pi.id::text = ct.payment_reference
    )
    and not exists (
      select 1 from public.ledger_entries le
      where le.ref_type = 'purchase' and le.ref_id = ct.id::text
    );
$$;

revoke all on function public.reconcile_financials(int) from public, anon, authenticated;
grant execute on function public.reconcile_financials(int) to service_role;

notify pgrst, 'reload schema';
