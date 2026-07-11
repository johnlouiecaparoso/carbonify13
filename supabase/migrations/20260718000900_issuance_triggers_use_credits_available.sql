-- ============================================================================
-- Fix the issuance triggers after available_credits was dropped (drift repair).
--
-- Root cause of "column available_credits of relation project_credits does not
-- exist" on VALIDATION: the live activate_validated_project_trigger (latest body
-- from 20260626000500) still INSERT/UPDATEs project_credits.available_credits.
-- 20260718000700 dropped that column, so validating a project now throws — the
-- projects UPDATE fails inside the AFTER-UPDATE trigger.
--
-- The 2026-07-11 M6 note ("available_credits maintained by NO trigger") was wrong:
-- BOTH activate_validated_project_trigger AND mint_credits_on_ver_approval write
-- it. credits_available (numeric) is the canonical pool column — it is what the
-- marketplace listing query and process_marketplace_purchase read/decrement — so
-- this redefines both trigger functions to write ONLY credits_available.
--
-- Behaviour is otherwise identical to the live definitions (same pool/listing
-- creation), and both are `create or replace` on existing functions, so the
-- attached triggers pick up the new bodies with no trigger DDL and no downtime.
-- ============================================================================

-- (1) Validation-time pool + listing creation — credits_available only.
create or replace function public.activate_validated_project_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_title text;
  v_project_credit_id uuid;
  v_listing_id uuid;
  v_total_credits numeric;
  v_price_per_credit numeric;
begin
  if lower(coalesce(new.status, '')) <> 'validated' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  v_project_title := coalesce(new.title, 'Untitled Project');
  v_total_credits := greatest(coalesce(new.estimated_credits, 1), 1);
  v_price_per_credit := greatest(coalesce(new.credit_price, 1), 0.01);

  select pc.id into v_project_credit_id
  from public.project_credits pc
  where pc.project_id = new.id
  order by pc.created_at asc
  limit 1;

  if v_project_credit_id is null then
    insert into public.project_credits (
      project_id, total_credits, credits_available, price_per_credit, currency
    ) values (
      new.id, v_total_credits, v_total_credits, v_price_per_credit, 'PHP'
    )
    returning id into v_project_credit_id;
  else
    update public.project_credits
      set total_credits      = greatest(coalesce(total_credits, v_total_credits), v_total_credits),
          credits_available  = least(coalesce(credits_available, total_credits, v_total_credits), v_total_credits),
          price_per_credit   = coalesce(nullif(new.credit_price, 0), price_per_credit),
          currency           = coalesce(currency, 'PHP'),
          updated_at         = now()
    where id = v_project_credit_id;
  end if;

  select cl.id into v_listing_id
  from public.credit_listings cl
  where cl.project_credit_id = v_project_credit_id
    and cl.status = 'active'
  order by cl.created_at asc
  limit 1;

  if v_listing_id is null then
    insert into public.credit_listings (
      project_credit_id, seller_id, quantity, price_per_credit, currency, status,
      listing_type, title, description, category, location, verification_standard, listed_at
    ) values (
      v_project_credit_id, new.user_id, v_total_credits, v_price_per_credit, 'PHP', 'active',
      'sell',
      case when btrim(coalesce(v_project_title, '')) = '' then 'Carbon Credits' else v_project_title || ' - Carbon Credits' end,
      coalesce(new.description, 'Verified carbon credits from ' || coalesce(v_project_title, 'Untitled Project')),
      coalesce(new.category, 'General'),
      coalesce(new.location, 'Unknown Location'),
      'Carbonify Standard',
      now()
    )
    returning id into v_listing_id;
  end if;

  return new;
end;
$$;

-- (2) VER-approval minting — credits_available only (kept in sync so this path is
-- also drift-safe if it is the active issuance model on any environment).
create or replace function public.mint_credits_on_ver_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qty numeric;
  v_price numeric;
  v_project record;
  v_project_credit_id uuid;
  v_listing_id uuid;
begin
  if lower(coalesce(new.status, '')) <> 'approved' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_qty := greatest(coalesce(new.approved_quantity, 0), 0);
  if v_qty <= 0 then
    return new;
  end if;

  select id, user_id, title, description, category, location, credit_price
    into v_project
  from public.projects
  where id = new.project_id;

  if v_project.id is null then
    return new;
  end if;

  v_price := greatest(coalesce(v_project.credit_price, 1), 0.01);

  select pc.id
    into v_project_credit_id
  from public.project_credits pc
  where pc.project_id = new.project_id
  order by pc.created_at asc
  limit 1;

  if v_project_credit_id is null then
    insert into public.project_credits (
      project_id, total_credits, credits_available, price_per_credit, currency
    ) values (
      new.project_id, v_qty, v_qty, v_price, 'PHP'
    )
    returning id into v_project_credit_id;
  else
    update public.project_credits
      set total_credits     = coalesce(total_credits, 0) + v_qty,
          credits_available = coalesce(credits_available, 0) + v_qty,
          price_per_credit  = coalesce(nullif(v_project.credit_price, 0), price_per_credit),
          currency          = coalesce(currency, 'PHP'),
          updated_at        = now()
    where id = v_project_credit_id;
  end if;

  select cl.id
    into v_listing_id
  from public.credit_listings cl
  where cl.project_credit_id = v_project_credit_id
    and cl.status = 'active'
  order by cl.created_at asc
  limit 1;

  if v_listing_id is null then
    insert into public.credit_listings (
      project_credit_id, seller_id, quantity, price_per_credit, currency,
      status, listing_type, title, description, category, location,
      verification_standard, listed_at
    ) values (
      v_project_credit_id,
      v_project.user_id,
      v_qty,
      v_price,
      'PHP',
      'active',
      'sell',
      case when btrim(coalesce(v_project.title, '')) = ''
        then 'Carbon Credits'
        else v_project.title || ' - Carbon Credits' end,
      coalesce(v_project.description, 'Verified carbon credits from ' || coalesce(v_project.title, 'project')),
      coalesce(v_project.category, 'Renewable Energy'),
      coalesce(v_project.location, 'Unknown Location'),
      'Carbonify Standard',
      now()
    );
  else
    update public.credit_listings
      set quantity = coalesce(quantity, 0) + v_qty,
          price_per_credit = v_price
    where id = v_listing_id;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
