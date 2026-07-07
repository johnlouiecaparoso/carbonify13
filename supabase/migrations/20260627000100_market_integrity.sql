-- ============================================================================
-- Phase 4 — Market integrity + public market dashboard.
--
-- 1) Double-claim prevention: a registry serial identifies a specific issued
--    credit. The same serial must never be attached to two certificates, or a
--    non-retired credit could be sold/claimed twice. We enforce uniqueness with
--    a partial unique index on certificates.registry_serial.
--
--    DATA-SAFE: if the live table already holds duplicate non-null serials, the
--    unique index would fail to build — so we detect that case, fall back to a
--    plain index, and raise a notice instead of aborting the migration.
--
-- 2) public_market_stats(): anon-granted, SECURITY DEFINER headline market
--    figures for a public market dashboard (totals, price range, retired vs
--    available) — exposes only aggregates, no PII, like the registry RPCs.
-- ============================================================================

-- 1) Double-claim guard --------------------------------------------------------
do $$
begin
  if to_regclass('public.certificates') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'certificates' and column_name = 'registry_serial'
     )
  then
    if not exists (
      select 1 from public.certificates
      where registry_serial is not null
      group by registry_serial
      having count(*) > 1
    ) then
      create unique index if not exists uq_cert_registry_serial
        on public.certificates (registry_serial)
        where registry_serial is not null;
    else
      raise notice 'Duplicate registry_serial values exist; created a NON-unique index. Resolve duplicates, then add the unique guard.';
      create index if not exists idx_cert_registry_serial
        on public.certificates (registry_serial)
        where registry_serial is not null;
    end if;
  end if;
end $$;

-- 2) Public market dashboard stats --------------------------------------------
create or replace function public.public_market_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'active_listings',
      (select count(*) from public.credit_listings where status = 'active'),
    'credits_available',
      (select coalesce(sum(quantity), 0) from public.credit_listings where status = 'active'),
    'avg_price',
      (select coalesce(round(avg(price_per_credit)::numeric, 2), 0)
         from public.credit_listings where status = 'active' and price_per_credit > 0),
    'min_price',
      (select coalesce(min(price_per_credit), 0)
         from public.credit_listings where status = 'active' and price_per_credit > 0),
    'max_price',
      (select coalesce(max(price_per_credit), 0)
         from public.credit_listings where status = 'active' and price_per_credit > 0),
    'total_retired',
      (select coalesce(sum(quantity), 0) from public.credit_retirements),
    'total_issued',
      (select coalesce(sum(credits_quantity), 0)
         from public.certificates where coalesce(status, 'active') = 'active'),
    'listed_projects',
      (select count(distinct pc.project_id)
         from public.credit_listings cl
         join public.project_credits pc on pc.id = cl.project_credit_id
        where cl.status = 'active')
  );
$$;

grant execute on function public.public_market_stats() to anon, authenticated;

notify pgrst, 'reload schema';
