-- ============================================================================
-- Buyer watchlist — let users save/follow marketplace listings.
--
-- Keyed on the marketplace listing id (credit_listings.id) with project_id kept
-- alongside so the watchlist page can fall back to the project if a listing is
-- later removed/sold out. No hard FK to credit_listings (listing tables have
-- known drift); rows are cleaned up lazily when a listing no longer resolves.
-- Owner-only via RLS.
-- ============================================================================

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
