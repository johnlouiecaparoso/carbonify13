-- ============================================================================
-- Fix projects.status check constraint to cover the full MRV workflow.
--
-- public.projects predates the tracked migrations, so its CHECK constraint was
-- never widened past the original ('pending', 'approved', 'rejected'). The app's
-- verification workflow, however, moves a project through additional statuses —
-- most visibly 'needs_revision' (set when a verifier requests changes) and
-- 'submitted' / 'in_review' / 'validated' (the canonical workflow states). With
-- the old constraint, "Request Revision" fails:
--   new row for relation "projects" violates check constraint "projects_status_check"
--
-- This drops the stale constraint and re-adds one allowing every status the app
-- writes (see PROJECT_WORKFLOW_STATUS + legacy aliases). Existing rows already
-- hold a subset of these, so the re-add validates cleanly.
-- ============================================================================

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (
    status in (
      'draft',
      'pending',
      'submitted',
      'in_review',
      'under_review',
      'needs_revision',
      'approved',
      'validated',
      'rejected'
    )
  );

notify pgrst, 'reload schema';
