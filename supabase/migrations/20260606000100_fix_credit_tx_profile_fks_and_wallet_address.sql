-- Resolve the remaining post-payment console 400s, authored against the live
-- schema (see supabase/diagnostics/phase0_schema_check.sql output).
--
-- Findings:
--   * credit_transactions.buyer_id / seller_id are bare UUIDs with NO foreign
--     key to profiles, so PostgREST cannot embed profiles -> the receipt and
--     certificate joins 400 ("Could not find a relationship between
--     'credit_transactions' and 'profiles' in the schema cache").
--   * wallet_accounts has no wallet_address column, but certificateService
--     selects it -> wallet_accounts?select=wallet_address 400s.

-- 1) Buyer/seller -> profiles foreign keys.
--    Names MUST match the embed hints the app uses:
--      receiptService.js / certificateService.js:
--        buyer:profiles!credit_transactions_buyer_id_fkey
--        seller:profiles!credit_transactions_seller_id_fkey
--    Added NOT VALID: PostgREST registers the relationship for embedding, but
--    the constraint is not checked against existing rows, so this migration
--    cannot fail on any legacy orphan row. Validate later once data is
--    confirmed clean (see the orphan check + VALIDATE statements at the bottom).
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

-- 2) wallet_address column read by certificateService. Nullable; the app already
--    falls back to "Verified via payment reference" when it is absent/null.
alter table public.wallet_accounts
  add column if not exists wallet_address text;

-- 3) Ask PostgREST to reload its schema cache so the new relationship/column
--    are visible immediately (Supabase usually auto-reloads on DDL).
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- OPTIONAL follow-up (run manually after confirming no orphans):
--   -- Any transactions whose buyer/seller has no profiles row?
--   select count(*) from public.credit_transactions ct
--     left join public.profiles p on p.id = ct.buyer_id  where p.id is null;
--   select count(*) from public.credit_transactions ct
--     left join public.profiles p on p.id = ct.seller_id where p.id is null;
--   -- If both are 0, promote the constraints to fully validated:
--   alter table public.credit_transactions validate constraint credit_transactions_buyer_id_fkey;
--   alter table public.credit_transactions validate constraint credit_transactions_seller_id_fkey;
