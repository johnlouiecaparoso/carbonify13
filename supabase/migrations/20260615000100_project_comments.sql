-- ============================================================================
-- Developer ↔ Verifier communication: persistent comment thread + resubmit loop
--
-- Adds a two-way comment thread attached to each project so the
-- "needs_revision → developer edits & resubmits → re-review" cycle has a record
-- of the conversation. Verifiers/admins can also leave INTERNAL notes that the
-- project owner never sees.
--
-- The needs_revision status itself already exists (free-text projects.status,
-- notification trigger 20260402002000). This migration adds the thread + a
-- revision counter.
-- ============================================================================

-- Revision counter on projects (how many times it has bounced back) ----------
alter table public.projects
  add column if not exists revision_count integer not null default 0;

-- Comment thread -------------------------------------------------------------
create table if not exists public.project_comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  author_role text,                              -- snapshot of role at post time
  body        text not null check (length(trim(body)) > 0),
  -- internal = verifier/admin-only note, never shown to the project owner
  is_internal boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_project_comments_project
  on public.project_comments(project_id, created_at);

alter table public.project_comments enable row level security;

-- Helper: is the current user a verifier or admin? --------------------------
create or replace function public.is_verifier_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('verifier', 'admin')
  )
$$;

-- Helper: does the current user own this project? ---------------------------
create or replace function public.owns_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects pr
    where pr.id = p_project_id and pr.user_id = auth.uid()
  )
$$;

-- SELECT: owners see non-internal comments on their projects; verifiers/admins
-- see everything.
drop policy if exists "project_comments_select" on public.project_comments;
create policy "project_comments_select"
  on public.project_comments for select
  using (
    public.is_verifier_or_admin()
    or (not is_internal and public.owns_project(project_id))
  );

-- INSERT: must author as yourself. Owners may post visible comments on their
-- own projects; verifiers/admins may post on any project (and only they may
-- set is_internal = true).
drop policy if exists "project_comments_insert" on public.project_comments;
create policy "project_comments_insert"
  on public.project_comments for insert
  with check (
    author_id = auth.uid()
    and (
      public.is_verifier_or_admin()
      or (public.owns_project(project_id) and is_internal = false)
    )
  );

-- No updates/deletes: the thread is an append-only record.
