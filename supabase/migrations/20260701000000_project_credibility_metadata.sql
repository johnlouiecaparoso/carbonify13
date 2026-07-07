-- ============================================================================
-- Phase 3 (buyer trust) — structured additionality + permanence metadata.
--
-- Until now additionality was only a PDF upload and permanence was not captured
-- at all. This adds three structured, machine-readable fields on `projects` so
-- the buyer-facing trust card can show *why* a project is additional and how
-- durable its removals are, instead of relying on a document nobody reads:
--   • additionality_type  — which barrier makes the project additional
--   • permanence_years    — how long the removal is expected to persist
--   • reversal_risk        — qualitative risk the carbon is re-released
--
-- Additive + idempotent + drift-safe: columns are added only if missing, CHECK
-- constraints are added only if absent, and re-running is a no-op. No existing
-- flow reads these yet, so this cannot break anything already live.
-- ============================================================================

do $$
begin
  if to_regclass('public.projects') is not null then
    alter table public.projects add column if not exists additionality_type text;
    alter table public.projects add column if not exists permanence_years integer;
    alter table public.projects add column if not exists reversal_risk text;

    -- Constrain to the known vocabularies, but only if the check isn't there yet.
    if not exists (
      select 1 from pg_constraint where conname = 'projects_additionality_type_check'
    ) then
      alter table public.projects
        add constraint projects_additionality_type_check
        check (additionality_type is null or additionality_type in
          ('financial', 'technological', 'institutional', 'common_practice'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'projects_reversal_risk_check'
    ) then
      alter table public.projects
        add constraint projects_reversal_risk_check
        check (reversal_risk is null or reversal_risk in ('low', 'medium', 'high'));
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'projects_permanence_years_check'
    ) then
      alter table public.projects
        add constraint projects_permanence_years_check
        check (permanence_years is null or (permanence_years >= 0 and permanence_years <= 1000));
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
