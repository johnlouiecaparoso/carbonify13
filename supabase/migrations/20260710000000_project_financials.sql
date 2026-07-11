-- ============================================================================
-- Project financials — for the Investor Portal (expansion feature #5).
--
-- The submit form already collects CAPEX/OPEX but the create path silently drops
-- them (they were never columns on `projects`). The Investor Portal needs real
-- financial inputs to compute IRR / NPV / payback / funding gap, so persist them
-- plus a project lifetime and funding target/raised. All optional; existing
-- projects keep working and the portal degrades gracefully when they're null.
--
--   capex                 — up-front capital expenditure (PHP).
--   opex                  — annual operating expenditure (PHP/yr).
--   project_lifetime_years— crediting/operating horizon used for the cashflow model.
--   funding_target        — capital the developer is seeking (PHP).
--   funding_raised        — capital committed so far (PHP) → funding gap.
--
-- Additive + idempotent + drift-safe. No existing flow reads these yet.
-- ============================================================================

do $$
begin
  if to_regclass('public.projects') is not null then
    alter table public.projects add column if not exists capex numeric;
    alter table public.projects add column if not exists opex numeric;
    alter table public.projects add column if not exists project_lifetime_years numeric;
    alter table public.projects add column if not exists funding_target numeric;
    alter table public.projects add column if not exists funding_raised numeric;

    if not exists (select 1 from pg_constraint where conname = 'projects_capex_check') then
      alter table public.projects add constraint projects_capex_check
        check (capex is null or capex >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'projects_opex_check') then
      alter table public.projects add constraint projects_opex_check
        check (opex is null or opex >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'projects_lifetime_check') then
      alter table public.projects add constraint projects_lifetime_check
        check (project_lifetime_years is null or project_lifetime_years >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'projects_funding_target_check') then
      alter table public.projects add constraint projects_funding_target_check
        check (funding_target is null or funding_target >= 0);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'projects_funding_raised_check') then
      alter table public.projects add constraint projects_funding_raised_check
        check (funding_raised is null or funding_raised >= 0);
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
