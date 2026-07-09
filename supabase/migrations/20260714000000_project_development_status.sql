-- ============================================================================
-- Project development status — closes expansion #1's "development status" bullet.
--
-- The registry displayed `projects.status`, which is the Carbonify VALIDATION
-- workflow (draft → submitted → in_review → validated → rejected). That is not
-- what the spec means by development status, and conflating them misleads:
-- a project can be fully `validated` on the platform and still be nothing but a
-- feasibility study in the real world.
--
-- `development_status` is the real-world lifecycle, orthogonal to `status`:
--   concept → feasibility → financing → construction → operational → decommissioned
--
-- Nullable: existing projects have never been asked, and defaulting them to
-- 'concept' would assert something untrue about every project already in the
-- registry. The UI shows "—" until a developer sets it.
--
-- `methodology` stays TEXT (no CHECK): the UI now drives it from a canonical list
-- (src/constants/projectRegistry.js) so new rows are filterable, but legacy rows
-- hold free text like 'Verra VM0044' and a constraint would reject them on any
-- later UPDATE — including updates that have nothing to do with methodology.
--
-- Additive + idempotent + drift-safe. Safe to re-run.
-- ============================================================================

do $$
begin
  if to_regclass('public.projects') is not null then
    alter table public.projects add column if not exists development_status text;

    if not exists (select 1 from pg_constraint where conname = 'projects_development_status_check') then
      alter table public.projects add constraint projects_development_status_check
        check (
          development_status is null
          or development_status in (
            'concept', 'feasibility', 'financing', 'construction', 'operational', 'decommissioned'
          )
        );
    end if;

    -- Investors filter the pipeline by lifecycle stage; validated projects only.
    create index if not exists idx_projects_development_status
      on public.projects (development_status)
      where development_status is not null;
  end if;
end $$;

notify pgrst, 'reload schema';
