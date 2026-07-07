-- ============================================================================
-- Schema catch-up audit (READ-ONLY).
--
-- Run this whole script in the Supabase SQL Editor. It reports every object the
-- app expects that is MISSING on this database — tables, drift-prone columns,
-- foreign keys, and key functions. An empty result means the schema is fully
-- current. Paste the output back and we map each missing item to the migration
-- that creates it.
--
-- Nothing is modified. Safe to run anytime.
-- ============================================================================

with
-- ── expected tables ────────────────────────────────────────────────────────
expected_tables(name) as (
  values
    ('profiles'), ('projects'), ('project_credits'), ('credit_listings'),
    ('credit_transactions'), ('credit_ownership'), ('credit_purchases'),
    ('credit_retirements'), ('certificates'), ('wallet_accounts'),
    ('wallet_transactions'), ('payment_intents'), ('webhook_events'),
    ('idempotency_keys'), ('ledger_entries'), ('escrow_holds'),
    ('payout_requests'), ('kyb_applications'), ('kyc_applications'),
    ('disputes'), ('supplier_orders'), ('role_applications'),
    ('system_notifications'), ('audit_logs'), ('app_settings'),
    ('methodology_factors'), ('watchlist'), ('project_comments'),
    ('verification_assessments'), ('monitoring_reports'),
    ('verified_emission_reductions'), ('lgu_emissions_records'),
    ('data_subject_requests')
),
-- ── expected columns (table, column) — drift-prone reads ───────────────────
expected_columns(tbl, col) as (
  values
    ('projects','geo_coordinates'), ('projects','barangay'), ('projects','municipality'),
    ('projects','feasibility_score'), ('projects','social_impact_score'),
    ('projects','climate_risk_rating'), ('projects','methodology'), ('projects','vintage'),
    ('projects','co_benefits'), ('projects','boundary'), ('projects','revision_count'),
    ('projects','estimated_credits'), ('projects','credit_price'), ('projects','project_image'),
    ('projects','verification_notes'), ('projects','verified_by'), ('projects','verified_at'),
    ('project_credits','credits_available'), ('project_credits','available_credits'),
    ('project_credits','total_credits'), ('project_credits','vintage_year'),
    ('project_credits','verification_standard'), ('project_credits','source'),
    ('credit_listings','source'), ('credit_listings','listing_type'),
    ('credit_listings','verification_standard'), ('credit_listings','listed_at'),
    ('certificates','registry_serial'), ('certificates','registry_receipt_url'),
    ('wallet_accounts','wallet_address'),
    ('profiles','kyc_level'), ('profiles','kyb_verified'),
    ('profiles','organization_name'), ('profiles','organization_type')
),
-- ── expected foreign keys (by constraint name) ─────────────────────────────
expected_fks(name) as (
  values
    ('credit_transactions_buyer_id_fkey'),
    ('credit_transactions_seller_id_fkey')
),
-- ── expected functions ─────────────────────────────────────────────────────
expected_funcs(name) as (
  values
    ('is_admin'), ('get_setting'), ('resolve_notification_recipient_ids'),
    ('insert_system_notification'), ('process_marketplace_purchase'),
    ('reconcile_financials'), ('activate_validated_project_trigger'),
    ('submit_data_subject_request'), ('cancel_data_subject_request'),
    ('admin_finance_summary'), ('admin_recent_transactions'),
    ('admin_reconcile_financials'), ('review_kyc_application'),
    ('current_plan'), ('activate_subscription'), ('notify_project_submitted_trigger')
)
select 'TABLE'  as kind, name as object, 'missing table' as note
from expected_tables
where to_regclass('public.' || name) is null
union all
select 'COLUMN', tbl || '.' || col, 'missing column'
from expected_columns ec
where not exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = ec.tbl and c.column_name = ec.col
)
union all
select 'FK', name, 'missing foreign key (breaks PostgREST joins)'
from expected_fks ef
where not exists (select 1 from pg_constraint where conname = ef.name)
union all
select 'FUNCTION', name, 'missing function/RPC'
from expected_funcs ff
where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = ff.name
)
order by kind, object;
