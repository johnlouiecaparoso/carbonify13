-- Phase 3.1 — Credit provenance flag.
--
-- Credits on Ecolink are either minted internally ('local') or sourced from an
-- external registry/supplier ('supplier'). Tagging listings + the project pool
-- lets the marketplace show both honestly, side by side, rather than implying
-- everything is registry-backed. Existing rows default to 'local'.

alter table public.credit_listings
  add column if not exists source text not null default 'local'
  check (source in ('local', 'supplier'));

alter table public.project_credits
  add column if not exists source text default 'local';

create index if not exists idx_credit_listings_source
  on public.credit_listings (source);

notify pgrst, 'reload schema';
