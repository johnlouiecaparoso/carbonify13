-- ============================================================================
-- Phase 7 — Performance indexes for hot query paths.
--
-- Covers the filters/joins the app runs most: marketplace listing fetch, the
-- admin finance console, the public registry, buyer portfolio/receipts, and
-- reconciliation lookups. Without these, those queries seq-scan as data grows.
--
-- Drift-safe: each index is created only when its table AND column(s) exist
-- (the live schema has historically lagged migrations), so this never fails on
-- a partially-migrated DB. CREATE INDEX IF NOT EXISTS makes re-runs no-ops.
-- ============================================================================

-- Single-column indexes ------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('credit_listings',     'status',            'idx_cl_status'),
      ('credit_listings',     'project_credit_id', 'idx_cl_project_credit'),
      ('credit_listings',     'seller_id',         'idx_cl_seller'),
      ('credit_transactions', 'buyer_id',          'idx_ct_buyer'),
      ('credit_transactions', 'seller_id',         'idx_ct_seller'),
      ('credit_transactions', 'project_credit_id', 'idx_ct_project_credit'),
      ('credit_transactions', 'status',            'idx_ct_status'),
      ('credit_transactions', 'payment_reference', 'idx_ct_payment_ref'),
      ('project_credits',     'project_id',        'idx_pc_project'),
      ('projects',            'status',            'idx_projects_status'),
      ('projects',            'user_id',           'idx_projects_user'),
      ('certificates',        'status',            'idx_cert_status'),
      ('certificates',        'certificate_number','idx_cert_number'),
      ('certificates',        'user_id',           'idx_cert_user'),
      ('receipts',            'transaction_id',    'idx_receipts_txn'),
      ('payment_intents',     'status',            'idx_pi_status'),
      ('payment_intents',     'user_id',           'idx_pi_user'),
      ('ledger_entries',      'account',           'idx_le_account'),
      ('ledger_entries',      'entry_id',          'idx_le_entry')
    ) as t(tbl, col, idx)
  loop
    if to_regclass('public.' || r.tbl) is not null
       and exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = r.tbl and column_name = r.col
       )
    then
      execute format('create index if not exists %I on public.%I (%I)', r.idx, r.tbl, r.col);
    end if;
  end loop;
end $$;

-- Composite indexes (explicit, with guards) ----------------------------------

-- Registry: active certificates ordered by issue date.
do $$
begin
  if to_regclass('public.certificates') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='certificates' and column_name='status')
     and exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='certificates' and column_name='issued_at')
  then
    create index if not exists idx_cert_status_issued
      on public.certificates (status, issued_at desc);
  end if;
end $$;

-- Reconciliation: ledger lookups by (ref_type, ref_id).
do $$
begin
  if to_regclass('public.ledger_entries') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='ledger_entries' and column_name='ref_type')
     and exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='ledger_entries' and column_name='ref_id')
  then
    create index if not exists idx_le_ref on public.ledger_entries (ref_type, ref_id);
  end if;
end $$;

notify pgrst, 'reload schema';
