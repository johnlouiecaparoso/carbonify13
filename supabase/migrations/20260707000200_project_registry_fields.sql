-- ============================================================================
-- Project Registry fields — feedstock + capacity.
--
-- The investor-facing project registry (ProjectDetailView) needs two structured
-- fields the projects table doesn't carry yet. Both are optional; existing
-- projects keep working. `methodology` already exists (migration 20260607000400)
-- but was never captured on the submit form — this change also wires it in on the
-- app side (no schema change needed for methodology).
--
--   feedstock       — biomass/input material, e.g. 'Rice husk', 'Coconut biomass',
--                     'Sugarcane bagasse', 'Bana grass'. Free text (varies widely).
--   capacity        — nameplate/throughput figure, e.g. 10 (MW) or 5000 (tonnes/yr).
--   capacity_unit   — unit for `capacity`, e.g. 'MW', 'tonnes/year', 'kWh/year'.
--
-- Additive + idempotent + drift-safe: columns are added only if missing, the
-- capacity CHECK is added only if absent, and re-running is a no-op. No existing
-- flow reads these yet, so this cannot break anything already live.
-- ============================================================================

do $$
begin
  if to_regclass('public.projects') is not null then
    alter table public.projects add column if not exists feedstock text;
    alter table public.projects add column if not exists capacity numeric;
    alter table public.projects add column if not exists capacity_unit text;

    -- Capacity must be non-negative when provided.
    if not exists (
      select 1 from pg_constraint where conname = 'projects_capacity_check'
    ) then
      alter table public.projects
        add constraint projects_capacity_check
        check (capacity is null or capacity >= 0);
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
