-- ============================================================================
-- CO₂ removed vs avoided — closes expansion #4's remaining credibility bullet.
--
-- The MRV dashboard summed every verified emission reduction into ONE tCO₂e
-- figure. Registries and buyers price removals and avoidances very differently:
-- a durable removal (biochar, afforestation) is not interchangeable with an
-- avoided emission (methane capture, clean energy displacing coal). Collapsing
-- them hides exactly the distinction a carbon buyer looks for first.
--
-- `reduction_type` classifies each VER as 'removal' or 'avoidance'.
--
-- ── Why it is NULLABLE, and why nothing is backfilled ──────────────────────
-- Existing VERs were approved without anyone being asked this question. We could
-- guess from the project category, but a category is not decisive — a biochar
-- project removes carbon AND the bio-briquettes burnt alongside it avoid
-- emissions. Silently stamping a guess onto an already-issued credit would be a
-- registry-grade error: it would look like a verifier's assertion when nobody
-- asserted it.
--
-- So legacy rows stay NULL and the dashboard reports them in an explicit
-- "Unclassified" bucket. The project category only PRE-SELECTS the verifier's
-- dropdown on new approvals (src/constants/mrv.js suggestedReductionType).
--
-- Additive + idempotent + drift-safe. Safe to re-run.
-- ============================================================================

do $$
begin
  if to_regclass('public.verified_emission_reductions') is not null then
    alter table public.verified_emission_reductions
      add column if not exists reduction_type text;

    if not exists (
      select 1 from pg_constraint where conname = 'ver_reduction_type_check'
    ) then
      alter table public.verified_emission_reductions
        add constraint ver_reduction_type_check
        check (reduction_type is null or reduction_type in ('removal', 'avoidance'));
    end if;

    -- The dashboard groups approved VERs by type per project.
    create index if not exists idx_ver_reduction_type
      on public.verified_emission_reductions (project_id, reduction_type)
      where status = 'approved';
  end if;
end $$;

notify pgrst, 'reload schema';
