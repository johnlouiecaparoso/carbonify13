-- ============================================================================
-- M6 consolidation, PHASE 1 of 2 — make the stray column safe to stop writing.
--
-- Historically the live project_credits table carried two availability columns:
--   credits_available (numeric) — CANONICAL. The money path decrements this.
--   available_credits (integer) — a stale stray from schema drift: never
--     decremented after a sale (observed 2000 where the true remaining was 1638),
--     maintained by NO trigger, and read by no code at this revision.
--
-- On some environments the stray was ALREADY dropped (a live run of this file
-- errored with 42703 "column available_credits does not exist"), so this phase is
-- guarded: if the column is present we relax its NOT NULL / default before the
-- frontend stops writing it; if it is already gone, this is a clean no-op.
-- Idempotent and safe to run NOW.
--
--   ▶ RUN THIS FIRST, then deploy the frontend, then run PHASE 2
--     (20260718000700_drop_available_credits.sql — also `if exists`-guarded).
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name  = 'project_credits'
      and column_name = 'available_credits'
  ) then
    alter table public.project_credits alter column available_credits drop not null;
    alter table public.project_credits alter column available_credits set default null;
  end if;
end $$;

notify pgrst, 'reload schema';
