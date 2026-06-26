-- ============================================================================
-- Phase 3 (scale) — COMPOSITE hot-path indexes.
--
-- 20260626001000 added single-column indexes; the heaviest queries filter on
-- TWO columns at once and order by date, which a composite index serves far
-- better. These match the app's actual access patterns:
--   • marketplace sold-qty scan: credit_transactions WHERE project_credit_id IN (..) AND status='completed'
--   • buyer purchase history:     credit_transactions WHERE buyer_id=? AND status=? ORDER BY completed_at DESC
--   • seller sales:               credit_transactions WHERE seller_id=? ORDER BY created_at DESC
--   • seller listings:            credit_listings WHERE seller_id=? AND status=?
--   • active marketplace:         credit_listings WHERE status='active' ORDER BY created_at DESC
--   • wallet / portfolio / retirement history ordered by date
--   • trade gate:                 profiles WHERE kyc_level >= ?
--
-- Drift-safe + idempotent: each index is created only when its table AND every
-- referenced column exist, and CREATE INDEX IF NOT EXISTS makes re-runs no-ops.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- (table, comma-separated column list with optional "desc", index name)
      ('credit_transactions', 'project_credit_id, status',        'idx_ct_pc_status'),
      ('credit_transactions', 'buyer_id, status, completed_at',   'idx_ct_buyer_status_completed'),
      ('credit_transactions', 'seller_id, created_at',            'idx_ct_seller_created'),
      ('credit_listings',     'seller_id, status',                'idx_cl_seller_status'),
      ('credit_listings',     'status, created_at',               'idx_cl_status_created'),
      ('credit_ownership',    'user_id',                          'idx_co_user'),
      ('credit_retirements',  'user_id, retired_at',              'idx_cr_user_retired'),
      ('wallet_transactions', 'account_id, created_at',           'idx_wt_account_created'),
      ('profiles',            'kyc_level',                        'idx_profiles_kyc')
    ) as t(tbl, cols, idx)
  loop
    -- Verify the table and every bare column name (strip a trailing " desc") exist.
    if to_regclass('public.' || r.tbl) is not null
       and not exists (
         select 1
         from unnest(string_to_array(r.cols, ',')) as c(col)
         where not exists (
           select 1 from information_schema.columns ic
           where ic.table_schema = 'public'
             and ic.table_name = r.tbl
             and ic.column_name = btrim(regexp_replace(c.col, '\s+desc$', '', 'i'))
         )
       )
    then
      -- Add DESC to the trailing date column where it helps ORDER BY ... DESC.
      execute format(
        'create index if not exists %I on public.%I (%s)',
        r.idx, r.tbl,
        case
          when r.cols like '%completed_at' then replace(r.cols, 'completed_at', 'completed_at desc')
          when r.cols like '%created_at'   then replace(r.cols, 'created_at',   'created_at desc')
          when r.cols like '%retired_at'   then replace(r.cols, 'retired_at',   'retired_at desc')
          else r.cols
        end
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
