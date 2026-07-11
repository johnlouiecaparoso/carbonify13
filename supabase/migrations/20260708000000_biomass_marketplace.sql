-- ============================================================================
-- Biomass Marketplace (feedstock RFQ) — expansion feature #3.
--
-- Suppliers list feedstock products (rice husk, biochar, bagasse, Bana grass…);
-- buyers submit a request-for-quotation (RFQ); the supplier responds with a
-- quote; the buyer accepts or declines. Reuses the existing KYB
-- (`profiles.kyb_verified`) + notification rails — NO new role is added.
--
-- Two tables:
--   biomass_products — a supplier's feedstock catalog listing (public browse).
--   biomass_rfqs     — a buyer's quote request + the supplier's quote response.
--                      The single quote is folded into the RFQ row (one quote per
--                      request) to keep the RLS surface small.
--
-- Status transitions on an RFQ go through SECURITY DEFINER RPCs (not a broad
-- UPDATE policy) so neither party can rewrite the other's fields. Additive +
-- idempotent + drift-safe: `create ... if not exists`, `drop policy if exists`,
-- and re-running is a no-op. Distinct from `supplier_orders` (external-registry
-- carbon-credit fulfillment) — unrelated table.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) Supplier feedstock catalog ---------------------------------------------
create table if not exists public.biomass_products (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references public.profiles(id) on delete cascade,
  product_type       text not null,
  title              text not null,
  description        text,
  unit               text not null default 'tonnes',
  price_per_unit     numeric check (price_per_unit is null or price_per_unit >= 0),
  quantity_available numeric check (quantity_available is null or quantity_available >= 0),
  location           text,
  region             text,
  currency           text not null default 'PHP',
  status             text not null default 'active'
                     check (status in ('active', 'inactive', 'sold_out')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_biomass_products_status
  on public.biomass_products (status, created_at desc);
create index if not exists idx_biomass_products_seller
  on public.biomass_products (seller_id, created_at desc);

-- 2) Request-for-quotation + folded-in quote response -----------------------
create table if not exists public.biomass_rfqs (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid references public.biomass_products(id) on delete set null,
  buyer_id              uuid not null references public.profiles(id) on delete cascade,
  seller_id             uuid not null references public.profiles(id) on delete cascade,
  product_type          text,
  product_title         text,
  quantity              numeric not null check (quantity > 0),
  unit                  text not null default 'tonnes',
  delivery_location     text,
  needed_by             date,
  message               text,
  status                text not null default 'open'
                        check (status in ('open', 'quoted', 'accepted', 'declined', 'closed')),
  quoted_price_per_unit numeric check (quoted_price_per_unit is null or quoted_price_per_unit >= 0),
  quoted_total          numeric,
  quote_message         text,
  quoted_at             timestamptz,
  responded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_biomass_rfqs_buyer  on public.biomass_rfqs (buyer_id, created_at desc);
create index if not exists idx_biomass_rfqs_seller on public.biomass_rfqs (seller_id, created_at desc);

-- 3) RLS --------------------------------------------------------------------
alter table public.biomass_products enable row level security;

-- Active products are public (anon marketplace browse); a seller/admin also sees
-- their own inactive/sold-out rows.
drop policy if exists "biomass_products browse" on public.biomass_products;
create policy "biomass_products browse"
  on public.biomass_products for select
  using (status = 'active' or seller_id = auth.uid() or public.is_admin());

drop policy if exists "biomass_products owner insert" on public.biomass_products;
create policy "biomass_products owner insert"
  on public.biomass_products for insert
  with check (seller_id = auth.uid());

drop policy if exists "biomass_products owner update" on public.biomass_products;
create policy "biomass_products owner update"
  on public.biomass_products for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "biomass_products owner delete" on public.biomass_products;
create policy "biomass_products owner delete"
  on public.biomass_products for delete
  using (seller_id = auth.uid() or public.is_admin());

alter table public.biomass_rfqs enable row level security;

-- Both parties (and admin) can read an RFQ; only the buyer can create one.
drop policy if exists "biomass_rfqs party select" on public.biomass_rfqs;
create policy "biomass_rfqs party select"
  on public.biomass_rfqs for select
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists "biomass_rfqs buyer insert" on public.biomass_rfqs;
create policy "biomass_rfqs buyer insert"
  on public.biomass_rfqs for insert
  with check (buyer_id = auth.uid());

-- Intentionally NO update/delete policy: all status transitions go through the
-- SECURITY DEFINER RPCs below, which self-guard on auth.uid(). This stops either
-- party from rewriting the other's fields via a broad UPDATE.

-- 4) Status-transition RPCs --------------------------------------------------

-- Supplier answers an RFQ with a per-unit price → status 'quoted'.
create or replace function public.submit_biomass_quote(
  p_rfq_id uuid,
  p_price_per_unit numeric,
  p_message text default null
) returns public.biomass_rfqs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq public.biomass_rfqs;
begin
  select * into v_rfq from public.biomass_rfqs where id = p_rfq_id;
  if not found then raise exception 'RFQ not found'; end if;
  if v_rfq.seller_id <> auth.uid() then
    raise exception 'Only the supplier can quote this request';
  end if;
  if v_rfq.status not in ('open', 'quoted') then
    raise exception 'This request can no longer be quoted';
  end if;
  if p_price_per_unit is null or p_price_per_unit < 0 then
    raise exception 'A valid price is required';
  end if;

  update public.biomass_rfqs
     set quoted_price_per_unit = p_price_per_unit,
         quoted_total          = round(p_price_per_unit * v_rfq.quantity, 2),
         quote_message         = p_message,
         quoted_at             = now(),
         status                = 'quoted',
         updated_at            = now()
   where id = p_rfq_id
   returning * into v_rfq;
  return v_rfq;
end;
$$;
grant execute on function public.submit_biomass_quote(uuid, numeric, text) to authenticated;

-- Buyer accepts or declines the supplier's quote.
create or replace function public.respond_biomass_quote(
  p_rfq_id uuid,
  p_accept boolean
) returns public.biomass_rfqs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq public.biomass_rfqs;
begin
  select * into v_rfq from public.biomass_rfqs where id = p_rfq_id;
  if not found then raise exception 'RFQ not found'; end if;
  if v_rfq.buyer_id <> auth.uid() then
    raise exception 'Only the buyer can respond to this quote';
  end if;
  if v_rfq.status <> 'quoted' then
    raise exception 'This request has no active quote to respond to';
  end if;

  update public.biomass_rfqs
     set status       = case when p_accept then 'accepted' else 'declined' end,
         responded_at = now(),
         updated_at   = now()
   where id = p_rfq_id
   returning * into v_rfq;
  return v_rfq;
end;
$$;
grant execute on function public.respond_biomass_quote(uuid, boolean) to authenticated;

-- Buyer closes/cancels their own request.
create or replace function public.close_biomass_rfq(p_rfq_id uuid)
returns public.biomass_rfqs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rfq public.biomass_rfqs;
begin
  select * into v_rfq from public.biomass_rfqs where id = p_rfq_id;
  if not found then raise exception 'RFQ not found'; end if;
  if v_rfq.buyer_id <> auth.uid() then raise exception 'Not your request'; end if;

  update public.biomass_rfqs
     set status = 'closed', updated_at = now()
   where id = p_rfq_id
   returning * into v_rfq;
  return v_rfq;
end;
$$;
grant execute on function public.close_biomass_rfq(uuid) to authenticated;

notify pgrst, 'reload schema';
