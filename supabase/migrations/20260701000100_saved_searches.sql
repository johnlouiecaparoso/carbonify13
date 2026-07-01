-- ============================================================================
-- Buyer saved searches + price alerts (Phase 6 — buyer experience).
--
-- Lets a buyer persist a marketplace filter (category / source / price ceiling /
-- SDGs / keyword) and be alerted when a NEW matching listing appears or a
-- matching listing drops to/below their price ceiling. The criteria are stored
-- as JSONB so the shape can evolve with the marketplace filters without a
-- migration; matching is evaluated by the tested savedSearchService.
--
-- `last_seen_at` is the high-water mark: only listings created after it count as
-- "new", so a buyer is alerted once per matching listing, not every visit.
--
-- Owner-only: a buyer only ever sees/edits their own saved searches (RLS). The
-- alert itself is written to system_notifications by the client for the SAME
-- user, which that table's `with check (auth.uid() = user_id)` insert policy
-- already permits — no SECURITY DEFINER trigger needed.
--
-- Idempotent + additive: safe to re-run; nothing else reads this table yet.
-- ============================================================================

create table if not exists public.saved_searches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  label         text not null default 'Saved search',
  criteria      jsonb not null default '{}'::jsonb,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_saved_searches_user
  on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

drop policy if exists "saved_searches owner select" on public.saved_searches;
create policy "saved_searches owner select"
  on public.saved_searches for select
  using (user_id = auth.uid());

drop policy if exists "saved_searches owner insert" on public.saved_searches;
create policy "saved_searches owner insert"
  on public.saved_searches for insert
  with check (user_id = auth.uid());

drop policy if exists "saved_searches owner update" on public.saved_searches;
create policy "saved_searches owner update"
  on public.saved_searches for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "saved_searches owner delete" on public.saved_searches;
create policy "saved_searches owner delete"
  on public.saved_searches for delete
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
