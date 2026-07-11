-- ============================================================================
-- Farmer carbon participation — closes expansion #6's "view carbon participation".
--
-- A farmer could see sacks and pesos, never how their feedstock became carbon.
-- `farmer_deliveries` had NO link to a project, so attribution was impossible:
-- a delivery belongs to an RFQ whose buyer is a developer, and a developer may
-- run several projects.
--
-- This migration:
--   1. adds `farmer_deliveries.project_id` — the buyer names the project the
--      feedstock fed, when they confirm receipt;
--   2. re-creates `confirm_farmer_delivery()` to accept it (validating the buyer
--      owns that project — otherwise a buyer could attribute a rival's project);
--   3. adds `farmer_carbon_participation()`, which computes the farmer's share.
--
-- ── The attribution rule (see docs/FARMER_CARBON_ATTRIBUTION.md) ───────────
--   attributed = project_verified_tCO2e × farmer_tonnes / project_tonnes
--
-- Pro-rata by delivered mass, per project, lifetime-to-date, over CONFIRMED
-- deliveries and APPROVED VERs only. Shares sum to exactly 1, so a farmer can
-- never be attributed carbon the project did not verify.
--
-- Only mass-denominated units convert: tonnes and kg. Sacks / bales / m³ have no
-- defensible tonnage without bulk-density factors we do not have, so they are
-- excluded from BOTH sides of the ratio. Treating a sack as a tonne would corrupt
-- every other farmer's share too — the denominator is shared.
--
-- This is an ESTIMATE surfaced to the farmer, never a credit they own.
--
-- Additive + idempotent + drift-safe. Safe to re-run.
-- ============================================================================

-- 1) Delivery → project ------------------------------------------------------
do $$
begin
  if to_regclass('public.farmer_deliveries') is not null then
    alter table public.farmer_deliveries
      add column if not exists project_id uuid references public.projects(id) on delete set null;

    create index if not exists idx_farmer_deliveries_project
      on public.farmer_deliveries (project_id)
      where project_id is not null;
  end if;
end $$;

-- 2) Buyer names the project when confirming receipt --------------------------
-- Drop the 3-arg version first: adding a defaulted 4th parameter would create an
-- ambiguous overload for existing 3-arg callers.
drop function if exists public.confirm_farmer_delivery(uuid, boolean, text);

create or replace function public.confirm_farmer_delivery(
  p_delivery_id uuid,
  p_accept boolean,
  p_note text default null,
  p_project_id uuid default null
) returns public.farmer_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.farmer_deliveries;
begin
  select * into v_delivery from public.farmer_deliveries where id = p_delivery_id;
  if not found then raise exception 'Delivery not found'; end if;
  if v_delivery.buyer_id <> auth.uid() then
    raise exception 'Only the buyer can confirm this delivery';
  end if;
  if v_delivery.status <> 'pending' then
    raise exception 'This delivery has already been reviewed';
  end if;

  -- You may only attribute feedstock to a project you own. Without this a buyer
  -- could inflate a rival's project, or a farmer's share of one.
  if p_project_id is not null and not exists (
    select 1 from public.projects where id = p_project_id and user_id = auth.uid()
  ) then
    raise exception 'That project does not belong to you';
  end if;

  update public.farmer_deliveries
     set status        = case when p_accept then 'confirmed' else 'rejected' end,
         confirmed_at  = now(),
         decision_note = nullif(btrim(p_note), ''),
         project_id    = coalesce(p_project_id, project_id),
         updated_at    = now()
   where id = p_delivery_id
   returning * into v_delivery;
  return v_delivery;
end;
$$;
revoke all on function public.confirm_farmer_delivery(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.confirm_farmer_delivery(uuid, boolean, text, uuid) to authenticated;

-- 3) The farmer's attributed carbon -------------------------------------------
-- SECURITY DEFINER so a farmer never needs read access to
-- `verified_emission_reductions` or to other farmers' delivery rows — the
-- function returns only their own attributed totals.
create or replace function public.farmer_carbon_participation()
returns table (
  project_id              uuid,
  project_title           text,
  farmer_tonnes           numeric,
  project_tonnes          numeric,
  share                   numeric,
  project_verified_tco2e  numeric,
  attributed_tco2e        numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with mass as (
    -- Confirmed, project-attributed deliveries, expressed in tonnes.
    -- Non-mass units yield NULL and are dropped by the WHERE below.
    select
      d.project_id,
      d.farmer_id,
      case lower(d.unit)
        when 'tonnes' then d.quantity
        when 'kg'     then d.quantity / 1000.0
        else null
      end as tonnes
    from public.farmer_deliveries d
    where d.status = 'confirmed'
      and d.project_id is not null
  ),
  usable as (
    select * from mass where tonnes is not null and tonnes > 0
  ),
  project_totals as (
    select project_id, sum(tonnes) as project_tonnes
    from usable group by project_id
  ),
  farmer_totals as (
    select project_id, farmer_id, sum(tonnes) as farmer_tonnes
    from usable where farmer_id = auth.uid() group by project_id, farmer_id
  ),
  verified as (
    select v.project_id, coalesce(sum(v.approved_quantity), 0)::numeric as verified_tco2e
    from public.verified_emission_reductions v
    where v.status = 'approved'
    group by v.project_id
  )
  select
    f.project_id,
    p.title as project_title,
    round(f.farmer_tonnes, 3)                                as farmer_tonnes,
    round(t.project_tonnes, 3)                               as project_tonnes,
    round(f.farmer_tonnes / t.project_tonnes, 6)             as share,
    round(coalesce(v.verified_tco2e, 0), 3)                  as project_verified_tco2e,
    round(coalesce(v.verified_tco2e, 0) * f.farmer_tonnes / t.project_tonnes, 3) as attributed_tco2e
  from farmer_totals f
  join project_totals t on t.project_id = f.project_id
  join public.projects p on p.id = f.project_id
  left join verified v on v.project_id = f.project_id
  where t.project_tonnes > 0
  order by attributed_tco2e desc;
$$;

revoke all on function public.farmer_carbon_participation() from public, anon;
grant execute on function public.farmer_carbon_participation() to authenticated;

comment on function public.farmer_carbon_participation() is
  'Estimated tCO2e attributed to the signed-in farmer, pro-rata by delivered mass per project (confirmed deliveries, approved VERs). An estimate, not credit ownership. See docs/FARMER_CARBON_ATTRIBUTION.md.';

notify pgrst, 'reload schema';
