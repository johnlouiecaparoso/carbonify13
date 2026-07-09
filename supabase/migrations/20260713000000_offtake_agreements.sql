-- ============================================================================
-- Offtake agreements (ERPAs) — closes expansion #5's missing spec bullet.
--
-- Until now the Investor Portal computed IRR from `estimated_credits × credit_price`
-- — an ASSUMED price for every credit the project might ever issue. An offtake
-- agreement (ERPA) is what turns a slice of that into CONTRACTED revenue. This
-- table lets a developer record their agreements so the portal can separate:
--
--   contracted revenue  — volume already under a signed/active agreement
--   speculative revenue — the remaining credits, valued at the listed price
--
-- and show investors a downside IRR computed on contracted revenue alone.
--
-- ── Confidentiality ────────────────────────────────────────────────────────
-- Counterparty names and negotiated prices are commercially sensitive. They are
-- NOT public:
--   • RLS restricts every row to its owning developer (and admins).
--   • Investors reach only AGGREGATES — contracted volume / value / count per
--     project — through `offtake_summary()`, a SECURITY DEFINER RPC that never
--     returns a counterparty, a price, or a document.
--   • The RPC is further scoped to `status = 'validated'` projects, i.e. exactly
--     the pipeline the Investor Portal already shows.
--
-- `signed` and `active` are the only statuses that count as contracted. A draft
-- or a terminated agreement contributes nothing — counting either would restate
-- speculative revenue as contracted, which is the precise error this table exists
-- to prevent.
--
-- Additive + idempotent + drift-safe. Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.offtake_agreements (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  developer_id      uuid not null references public.profiles(id) on delete cascade,
  counterparty_name text not null,
  -- Set when the buyer is an on-platform account; free-text name otherwise.
  counterparty_id   uuid references public.profiles(id) on delete set null,
  volume_credits    numeric not null check (volume_credits > 0),
  price_per_credit  numeric not null check (price_per_credit >= 0),
  currency          text not null default 'PHP',
  start_date        date,
  end_date          date,
  signed_on         date,
  status            text not null default 'draft'
                    check (status in ('draft', 'negotiating', 'signed', 'active', 'completed', 'terminated')),
  document_path     text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- An agreement can't end before it starts.
  constraint offtake_dates_ordered check (start_date is null or end_date is null or end_date >= start_date)
);

create index if not exists idx_offtake_project on public.offtake_agreements (project_id, status);
create index if not exists idx_offtake_developer on public.offtake_agreements (developer_id, created_at desc);

-- ── RLS: owner-only. Commercial terms never leave the developer + admin. ─────
alter table public.offtake_agreements enable row level security;

drop policy if exists "offtake owner select" on public.offtake_agreements;
create policy "offtake owner select"
  on public.offtake_agreements for select
  using (developer_id = auth.uid() or public.is_admin());

-- Insert is doubly guarded: you must claim yourself as the developer AND own the
-- project. Without the project check, a developer could attach an agreement to
-- someone else's project and inflate its contracted revenue.
drop policy if exists "offtake owner insert" on public.offtake_agreements;
create policy "offtake owner insert"
  on public.offtake_agreements for insert
  with check (
    developer_id = auth.uid()
    and exists (
      select 1 from public.projects p
       where p.id = project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "offtake owner update" on public.offtake_agreements;
create policy "offtake owner update"
  on public.offtake_agreements for update
  using (developer_id = auth.uid())
  with check (developer_id = auth.uid());

drop policy if exists "offtake owner delete" on public.offtake_agreements;
create policy "offtake owner delete"
  on public.offtake_agreements for delete
  using (developer_id = auth.uid() or public.is_admin());

-- ── Investor-facing aggregate. Deliberately returns NO counterparty/price. ───
-- Only 'signed'/'active' agreements count as contracted; only validated projects
-- are exposed (the Investor Portal's own pipeline scope).
create or replace function public.offtake_summary(p_project_ids uuid[])
returns table (
  project_id        uuid,
  contracted_volume numeric,
  contracted_value  numeric,
  agreement_count   bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.project_id,
    coalesce(sum(o.volume_credits), 0)::numeric                      as contracted_volume,
    coalesce(sum(o.volume_credits * o.price_per_credit), 0)::numeric as contracted_value,
    count(*)::bigint                                                 as agreement_count
  from public.offtake_agreements o
  join public.projects p on p.id = o.project_id
  where o.project_id = any(p_project_ids)
    and o.status in ('signed', 'active')
    and p.status = 'validated'
  group by o.project_id;
$$;

revoke all on function public.offtake_summary(uuid[]) from public, anon;
grant execute on function public.offtake_summary(uuid[]) to authenticated;

comment on table public.offtake_agreements is
  'ERPAs / offtake agreements per project (expansion #5). Owner-private: investors see only the offtake_summary() aggregate, never counterparty or price.';

notify pgrst, 'reload schema';
