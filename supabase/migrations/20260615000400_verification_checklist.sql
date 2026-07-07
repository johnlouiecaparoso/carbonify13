-- ============================================================================
-- Verifier tooling — structured validation checklist + SLA threshold.
--
-- A per-project assessment holding the verifier's rubric state (which criteria
-- pass, with notes). Internal verifier tooling: only verifiers/admins can read
-- or write it (project owners never see it). Reuses is_verifier_or_admin() from
-- the project-comments migration.
--
-- Also seeds verification_sla_days into app_settings so the review queue can
-- flag overdue submissions (admin-tunable in System Config).
-- ============================================================================

create table if not exists public.verification_assessments (
  project_id  uuid primary key references public.projects(id) on delete cascade,
  -- { itemKey: { checked: bool, note: text } }
  checklist   jsonb not null default '{}'::jsonb,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);

alter table public.verification_assessments enable row level security;

drop policy if exists "verification_assessments select" on public.verification_assessments;
create policy "verification_assessments select"
  on public.verification_assessments for select
  using (public.is_verifier_or_admin());

drop policy if exists "verification_assessments insert" on public.verification_assessments;
create policy "verification_assessments insert"
  on public.verification_assessments for insert
  with check (public.is_verifier_or_admin());

drop policy if exists "verification_assessments update" on public.verification_assessments;
create policy "verification_assessments update"
  on public.verification_assessments for update
  using (public.is_verifier_or_admin()) with check (public.is_verifier_or_admin());

-- SLA threshold (days a submission may wait before it's flagged overdue).
insert into public.app_settings (key, value, description) values
  ('verification_sla_days', '5'::jsonb,
    'Days a project may wait in the review queue before it is flagged overdue.')
on conflict (key) do nothing;
