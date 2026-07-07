-- Project edit/delete/approval permissions (RLS).
--
-- The public.projects table predates the tracked migrations, so its row-level
-- security policies only ever existed on the remote DB — and they did NOT let
-- project developers edit/delete their own pre-validation submissions, nor let
-- verifiers approve (status update) or delete projects. This adds those
-- policies explicitly so the behaviour is tracked and reproducible.
--
-- Roles are resolved via the existing helpers:
--   public.current_user_role()  -> raw role string from profiles
--   public.canonicalize_notification_role(text) -> normalized role
-- so legacy aliases ('developer', 'administrator', ...) all map correctly.
--
-- "Editable" = a submission that has not yet been validated/minted. Once a
-- project is validated (credits issued) or under active review, the developer
-- can no longer mutate it; only staff can.

alter table public.projects enable row level security;

-- Caller's normalized role, e.g. 'admin' | 'verifier' | 'project_developer'.
-- (Helper already exists; redefined here only if missing is NOT needed.)

-- ── Project developer: edit own submission while still editable ──────────────
drop policy if exists "projects_owner_update_editable" on public.projects;
create policy "projects_owner_update_editable" on public.projects
  for update to authenticated
  using (
    user_id = auth.uid()
    and coalesce(status, 'pending') in ('draft', 'pending', 'submitted', 'needs_revision')
  )
  with check (
    -- Cannot reassign ownership, and cannot self-promote the status into a
    -- validated/under-review state (that path belongs to verifiers and would
    -- otherwise trigger credit minting).
    user_id = auth.uid()
    and coalesce(status, 'pending') in ('draft', 'pending', 'submitted', 'needs_revision')
  );

-- ── Project developer: delete own submission while still editable ────────────
drop policy if exists "projects_owner_delete_editable" on public.projects;
create policy "projects_owner_delete_editable" on public.projects
  for delete to authenticated
  using (
    user_id = auth.uid()
    and coalesce(status, 'pending') in ('draft', 'pending', 'submitted', 'needs_revision')
  );

-- ── Verifier / Admin: update any project (approve, reject, status changes) ───
drop policy if exists "projects_staff_update" on public.projects;
create policy "projects_staff_update" on public.projects
  for update to authenticated
  using (
    public.canonicalize_notification_role(public.current_user_role()) in ('admin', 'verifier')
  )
  with check (
    public.canonicalize_notification_role(public.current_user_role()) in ('admin', 'verifier')
  );

-- ── Verifier / Admin: delete projects ───────────────────────────────────────
-- Admins may delete any project. Verifiers may delete any project that has NOT
-- been validated (i.e. has no minted credits / financial footprint) — "some
-- projects", per the moderation requirement.
drop policy if exists "projects_staff_delete" on public.projects;
create policy "projects_staff_delete" on public.projects
  for delete to authenticated
  using (
    public.canonicalize_notification_role(public.current_user_role()) = 'admin'
    or (
      public.canonicalize_notification_role(public.current_user_role()) = 'verifier'
      and coalesce(status, 'pending') <> 'validated'
    )
  );
