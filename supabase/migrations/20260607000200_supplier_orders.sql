-- Phase 3.3 — Supplier fulfillment state machine.
--
-- After a marketplace purchase settles (process_marketplace_purchase), a
-- 'supplier'-sourced credit must be ordered from and retired at an external
-- registry. This table is the saga's durable state, so a retried webhook
-- resumes instead of double-ordering, and so every fulfillment is auditable.
--
--   pending -> ordered -> retired
--   failed / refunded are terminal compensation states.
--
-- transaction_id is UNIQUE: one fulfillment per purchase = the idempotency key.

create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.credit_transactions(id),
  certificate_id uuid references public.certificates(id),
  supplier_id text not null default 'mock',
  supplier_order_id text,
  registry_serial text,
  retirement_receipt_url text,
  quantity numeric not null,
  status text not null default 'pending'
    check (status in ('pending', 'ordered', 'retired', 'failed', 'refunded')),
  last_error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplier_orders_status on public.supplier_orders (status);

alter table public.supplier_orders enable row level security;

-- Buyers may read the fulfillment record for their own purchases (read-only).
drop policy if exists "Buyers read own supplier orders" on public.supplier_orders;
create policy "Buyers read own supplier orders" on public.supplier_orders
  for select to authenticated
  using (
    transaction_id in (
      select id from public.credit_transactions where buyer_id = auth.uid()
    )
  );

-- All writes are server-only (the webhook function runs as service_role, which
-- bypasses RLS). No insert/update/delete policy is granted to authenticated, so
-- a logged-in user cannot fabricate or mutate a fulfillment record.

notify pgrst, 'reload schema';
