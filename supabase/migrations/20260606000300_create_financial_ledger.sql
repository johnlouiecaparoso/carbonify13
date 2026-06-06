-- Phase 1.4 — Money foundation: payment_intents, ledger_entries, idempotency_keys.
--
-- Design principles (see IMPLEMENTATION_ROADMAP_TIMELINE.md, Phase 1):
--   * Server authority: the authoritative amount lives in payment_intents.amount,
--     computed server-side from the listing — never trusted from the client.
--   * Double-entry: every money movement is recorded as balanced debit/credit
--     legs sharing an entry_id; balances are DERIVED by summing, never stored.
--   * Append-only: ledger_entries cannot be updated or deleted (enforced by
--     triggers), so the financial history is tamper-evident.
--   * Least privilege: all three tables are written only by trusted server code
--     (service role, which bypasses RLS). RLS is deny-by-default; users may read
--     only their own payment_intents.
--
-- Idempotent: safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1) payment_intents — the server-authoritative record of an intended payment.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  purpose text not null default 'marketplace_purchase'
    check (purpose in ('marketplace_purchase', 'wallet_topup')),
  listing_id uuid,                       -- null for wallet top-ups
  quantity numeric(18,4),
  unit_amount numeric(18,2),             -- server-resolved price per unit
  amount numeric(18,2) not null check (amount > 0),  -- server-computed total
  currency text not null default 'PHP',
  status text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'expired', 'canceled', 'refunded')),
  provider text not null default 'paymongo',
  provider_session_id text,
  provider_payment_id text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_intents_user on public.payment_intents (user_id, created_at desc);
create index if not exists idx_payment_intents_session on public.payment_intents (provider_session_id);
create index if not exists idx_payment_intents_status on public.payment_intents (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 2) ledger_entries — append-only double-entry ledger.
--    `account` is a typed string, e.g.:
--      'user_wallet:<uuid>'  'seller_payable:<uuid>'  'platform_fee'  'paymongo_clearing'
--    Each money movement inserts >= 2 rows sharing `entry_id`; debits must
--    equal credits within an entry_id (enforced by a deferred constraint trigger).
-- ---------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id bigint generated always as identity primary key,
  entry_id uuid not null default gen_random_uuid(),  -- groups the legs of one transaction
  account text not null,
  direction text not null check (direction in ('debit', 'credit')),
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'PHP',
  ref_type text,                          -- 'payment_intent' | 'purchase' | 'refund' | 'payout' ...
  ref_id text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_entries_account on public.ledger_entries (account, created_at desc);
create index if not exists idx_ledger_entries_entry on public.ledger_entries (entry_id);
create index if not exists idx_ledger_entries_ref on public.ledger_entries (ref_type, ref_id);

-- Append-only: block UPDATE and DELETE for everyone (including service role).
create or replace function public.prevent_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only (% is not allowed)', tg_op;
end;
$$;

drop trigger if exists ledger_no_update on public.ledger_entries;
create trigger ledger_no_update before update on public.ledger_entries
  for each row execute function public.prevent_ledger_mutation();

drop trigger if exists ledger_no_delete on public.ledger_entries;
create trigger ledger_no_delete before delete on public.ledger_entries
  for each row execute function public.prevent_ledger_mutation();

-- Double-entry invariant: debits = credits within each entry_id, checked at
-- COMMIT (deferred) so a multi-row insert can be balanced as a unit.
create or replace function public.assert_ledger_balanced()
returns trigger language plpgsql as $$
declare
  v_imbalance numeric;
begin
  select coalesce(sum(case when direction = 'debit' then amount else -amount end), 0)
    into v_imbalance
  from public.ledger_entries
  where entry_id = new.entry_id;

  if v_imbalance <> 0 then
    raise exception 'Ledger entry % is unbalanced by % (debits must equal credits)', new.entry_id, v_imbalance;
  end if;
  return null;
end;
$$;

drop trigger if exists ledger_balanced on public.ledger_entries;
create constraint trigger ledger_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.assert_ledger_balanced();

-- ---------------------------------------------------------------------------
-- 3) idempotency_keys — dedup client-initiated money mutations.
-- ---------------------------------------------------------------------------
create table if not exists public.idempotency_keys (
  key text primary key,
  scope text not null,                    -- e.g. 'create_checkout' | 'process_purchase'
  user_id uuid,
  request_hash text,                      -- hash of request params; detects mismatched reuse
  response jsonb,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_idempotency_keys_created on public.idempotency_keys (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default; service role bypasses RLS for all server writes.
-- Users may read ONLY their own payment_intents. ledger_entries and
-- idempotency_keys are server-only (no client policies); per-user balances will
-- be exposed via a security-definer function in a later step.
-- ---------------------------------------------------------------------------
alter table public.payment_intents enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.idempotency_keys enable row level security;

drop policy if exists "Users read own payment intents" on public.payment_intents;
create policy "Users read own payment intents" on public.payment_intents
  for select to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
