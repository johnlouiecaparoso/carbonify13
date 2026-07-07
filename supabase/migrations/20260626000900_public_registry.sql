-- ============================================================================
-- Phase 7 — Public carbon registry (transparency).
--
-- A real carbon market publishes its issued/retired credits so anyone — a
-- buyer's auditor, a regulator, the public — can independently confirm a credit
-- exists and isn't double-counted, WITHOUT logging in. The certificates table is
-- owner-restricted by RLS, so (like verify_certificate_public) these SECURITY
-- DEFINER RPCs expose only safe, non-PII fields. Granted to anon.
-- ============================================================================

-- Searchable, paginated list of active certificates.
create or replace function public.search_public_registry(
  p_search   text default null,
  p_category text default null,
  p_limit    int  default 50,
  p_offset   int  default 0
)
returns table (
  certificate_number text,
  certificate_type text,
  project_title text,
  project_category text,
  project_location text,
  credits_quantity numeric,
  beneficiary_name text,
  vintage_year integer,
  verification_standard text,
  issued_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.certificate_number::text,
    c.certificate_type::text,
    c.project_title::text,
    c.project_category::text,
    c.project_location::text,
    c.credits_quantity::numeric,
    c.beneficiary_name::text,
    c.vintage_year::integer,
    c.verification_standard::text,
    c.issued_at::timestamptz,
    c.status::text
  from public.certificates c
  where coalesce(c.status, 'active') = 'active'
    and (
      p_search is null or btrim(p_search) = ''
      or c.project_title ilike '%' || p_search || '%'
      or c.certificate_number ilike '%' || p_search || '%'
      or c.beneficiary_name ilike '%' || p_search || '%'
      or c.project_location ilike '%' || p_search || '%'
    )
    and (p_category is null or btrim(p_category) = '' or c.project_category = p_category)
  order by c.issued_at desc nulls last
  limit greatest(least(coalesce(p_limit, 50), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_public_registry(text, text, int, int) to anon, authenticated;

-- Headline totals for the registry page.
create or replace function public.public_registry_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'certificate_count', count(*),
    'total_credits', coalesce(sum(credits_quantity), 0),
    'project_count', count(distinct project_title)
  )
  from public.certificates
  where coalesce(status, 'active') = 'active';
$$;

grant execute on function public.public_registry_stats() to anon, authenticated;

notify pgrst, 'reload schema';
