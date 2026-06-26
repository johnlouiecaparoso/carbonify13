-- ============================================================================
-- Schema reconcile — ensure the marketplace + watchlist schema exists.
--
-- The live DB predates the tracked migrations and has been applied piecemeal,
-- so columns the marketplace listings query selects are missing on this DB. A
-- single missing column makes PostgREST 400 the WHOLE query, so the marketplace
-- shows 0 listings (and validated projects never appear). The watchlist table
-- is also absent (404 in console).
--
-- This consolidates the column/table requirements of several earlier migrations
-- (20260604030000 location, 20260604040000 scores, 20260607000100 source flag,
-- 20260607000400 metadata, 20260615000300 watchlist) into one idempotent run.
-- Every statement is ADD COLUMN / CREATE TABLE IF NOT EXISTS, so it is a no-op
-- where the object already exists and never changes an existing column's type.
-- ============================================================================

-- projects ------------------------------------------------------------------
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
alter table public.projects add column if not exists credit_price numeric;
alter table public.projects add column if not exists estimated_credits numeric;
alter table public.projects add column if not exists project_image text;
alter table public.projects add column if not exists image_name text;
alter table public.projects add column if not exists image_type text;
alter table public.projects add column if not exists supporting_documents text;
alter table public.projects add column if not exists verification_notes text;
alter table public.projects add column if not exists verified_by uuid;
alter table public.projects add column if not exists verified_at timestamptz;

-- project_credits -----------------------------------------------------------
alter table public.project_credits add column if not exists credits_available numeric;
alter table public.project_credits add column if not exists available_credits numeric;
alter table public.project_credits add column if not exists total_credits numeric;
alter table public.project_credits add column if not exists price_per_credit numeric;
alter table public.project_credits add column if not exists vintage_year integer;
alter table public.project_credits add column if not exists verification_standard text;
alter table public.project_credits add column if not exists source text default 'local';
alter table public.project_credits add column if not exists currency text default 'PHP';

-- Keep the two pool columns in sync so the marketplace (reads credits_available)
-- and the validation trigger/backfill (write available_credits) agree.
update public.project_credits
  set credits_available = coalesce(credits_available, available_credits, total_credits)
  where credits_available is null;
update public.project_credits
  set available_credits = coalesce(available_credits, credits_available, total_credits)
  where available_credits is null;

-- credit_listings -----------------------------------------------------------
alter table public.credit_listings add column if not exists source text not null default 'local';
alter table public.credit_listings add column if not exists listing_type text;
alter table public.credit_listings add column if not exists title text;
alter table public.credit_listings add column if not exists description text;
alter table public.credit_listings add column if not exists category text;
alter table public.credit_listings add column if not exists location text;
alter table public.credit_listings add column if not exists verification_standard text;
alter table public.credit_listings add column if not exists listed_at timestamptz default now();

create index if not exists idx_credit_listings_source on public.credit_listings (source);

-- watchlist (buyer save/follow) ---------------------------------------------
create table if not exists public.watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  listing_id  uuid not null,
  project_id  uuid,
  created_at  timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists idx_watchlist_user on public.watchlist (user_id, created_at desc);

alter table public.watchlist enable row level security;

drop policy if exists "watchlist owner select" on public.watchlist;
create policy "watchlist owner select"
  on public.watchlist for select using (user_id = auth.uid());

drop policy if exists "watchlist owner insert" on public.watchlist;
create policy "watchlist owner insert"
  on public.watchlist for insert with check (user_id = auth.uid());

drop policy if exists "watchlist owner delete" on public.watchlist;
create policy "watchlist owner delete"
  on public.watchlist for delete using (user_id = auth.uid());

notify pgrst, 'reload schema';
