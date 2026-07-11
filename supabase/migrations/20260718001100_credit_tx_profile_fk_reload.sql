-- ============================================================================
-- Fix the receipt join: PostgREST can't embed credit_transactions -> profiles.
--
-- The receipt query embeds buyer/seller profiles:
--   buyer:profiles!credit_transactions_buyer_id_fkey(full_name,email)
--   seller:profiles!credit_transactions_seller_id_fkey(full_name,email)
-- which 400s with "Could not find a relationship between 'credit_transactions'
-- and 'profiles' in the schema cache". The buyer_id/seller_id -> profiles(id)
-- FKs were added earlier (20260606000100 / 20260626000700), but PostgREST's
-- relationship cache is stale on this DB, so it doesn't know them. The client
-- falls back to per-profile reads, which then 406 under profiles RLS — so the
-- receipt renders without counterparty names.
--
-- This re-asserts both FKs (idempotent, NOT VALID so existing rows aren't
-- blocked) and reloads the PostgREST schema cache. After it, the embed resolves;
-- profiles RLS still governs WHICH embedded rows are visible (a party sees the
-- counterparty only where a profiles SELECT policy allows), but there is no 400.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credit_transactions_buyer_id_fkey') then
    alter table public.credit_transactions
      add constraint credit_transactions_buyer_id_fkey
      foreign key (buyer_id) references public.profiles(id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'credit_transactions_seller_id_fkey') then
    alter table public.credit_transactions
      add constraint credit_transactions_seller_id_fkey
      foreign key (seller_id) references public.profiles(id) not valid;
  end if;
end $$;

notify pgrst, 'reload schema';
