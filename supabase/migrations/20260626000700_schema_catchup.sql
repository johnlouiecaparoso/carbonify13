-- ============================================================================
-- Schema catch-up — one idempotent migration that brings the column / FK /
-- constraint surface the app READS fully up to date.
--
-- The live DB predates the tracked migrations and has been applied piecemeal,
-- which has repeatedly surfaced as "missing column" 400s and broken PostgREST
-- joins. This consolidates the column/FK/constraint requirements scattered
-- across several earlier migrations (location, scores, metadata, source flag,
-- credit-tx FKs, status constraint, pool sync) into a single safe apply.
--
-- Every statement is ADD COLUMN / guarded ADD CONSTRAINT IF NOT EXISTS, so it is
-- a no-op where the object already exists and never alters an existing type.
-- It does NOT create whole tables — run schema_catchup_audit.sql first; if that
-- reports a missing TABLE, apply that table's own migration.
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists kyc_level integer default 0;
alter table public.profiles add column if not exists kyb_verified boolean default false;
alter table public.profiles add column if not exists organization_name text;
alter table public.profiles add column if not exists organization_type text;
alter table public.profiles add column if not exists organization_address text;

-- ── projects ────────────────────────────────────────────────────────────────
alter table public.projects add column if not exists geo_coordinates text;
alter table public.projects add column if not exists barangay text;
alter table public.projects add column if not exists municipality text;
alter table public.projects add column if not exists feasibility_score integer;
alter table public.projects add column if not exists social_impact_score integer;
alter table public.projects add column if not exists climate_risk_rating text;
alter table public.projects add column if not exists methodology text;
alter table public.projects add column if not exists vintage integer;
alter table public.projects add column if not exists co_benefits jsonb default '[]'::jsonb;
alter table public.projects add column if not exists boundary jsonb;
alter table public.projects add column if not exists revision_count integer not null default 0;
alter table public.projects add column if not exists estimated_credits numeric;
alter table public.projects add column if not exists credit_price numeric;
alter table public.projects add column if not exists project_image text;
alter table public.projects add column if not exists image_name text;
alter table public.projects add column if not exists image_type text;
alter table public.projects add column if not exists image_size bigint;
alter table public.projects add column if not exists supporting_documents text;
alter table public.projects add column if not exists verification_notes text;
alter table public.projects add column if not exists verified_by uuid;
alter table public.projects add column if not exists verified_at timestamptz;

-- Widen the status CHECK to the full MRV workflow (no-op if already widened).
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in (
    'draft','pending','submitted','in_review','under_review',
    'needs_revision','approved','validated','rejected'
  ));

-- ── project_credits ─────────────────────────────────────────────────────────
alter table public.project_credits add column if not exists credits_available numeric;
alter table public.project_credits add column if not exists available_credits numeric;
alter table public.project_credits add column if not exists total_credits numeric;
alter table public.project_credits add column if not exists price_per_credit numeric;
alter table public.project_credits add column if not exists vintage_year integer;
alter table public.project_credits add column if not exists verification_standard text;
alter table public.project_credits add column if not exists source text default 'local';
alter table public.project_credits add column if not exists currency text default 'PHP';

-- Keep the two pool columns in sync (marketplace + purchase read credits_available).
update public.project_credits
  set credits_available = coalesce(credits_available, available_credits, total_credits)
  where credits_available is null;
update public.project_credits
  set available_credits = coalesce(available_credits, credits_available, total_credits)
  where available_credits is null;

-- ── credit_listings ─────────────────────────────────────────────────────────
alter table public.credit_listings add column if not exists source text not null default 'local';
alter table public.credit_listings add column if not exists listing_type text;
alter table public.credit_listings add column if not exists title text;
alter table public.credit_listings add column if not exists description text;
alter table public.credit_listings add column if not exists category text;
alter table public.credit_listings add column if not exists location text;
alter table public.credit_listings add column if not exists verification_standard text;
alter table public.credit_listings add column if not exists listed_at timestamptz default now();

-- ── certificates ────────────────────────────────────────────────────────────
alter table public.certificates add column if not exists registry_serial text;
alter table public.certificates add column if not exists registry_receipt_url text;

-- ── wallet_accounts ─────────────────────────────────────────────────────────
alter table public.wallet_accounts add column if not exists wallet_address text;

-- ── credit_transactions -> profiles foreign keys (PostgREST embed hints) ──────
-- NOT VALID: registers the relationship for embedding without validating legacy
-- rows, so this can't fail on any pre-existing orphan.
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
