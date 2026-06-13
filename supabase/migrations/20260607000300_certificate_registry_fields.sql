-- Phase 3.4 — Registry serial + retirement receipt on certificates.
--
-- When a credit is fulfilled through an external supplier, its certificate must
-- carry the real registry serial and a link to the retirement receipt so a
-- buyer's auditor can independently confirm it. Both are optional: locally
-- minted credits leave them null and their signature is unchanged (the signing
-- payload only includes these fields when registry_serial is present — see
-- certificateService.buildCertificateSignaturePayload).

alter table public.certificates
  add column if not exists registry_serial text;

alter table public.certificates
  add column if not exists registry_receipt_url text;

-- Re-publish the public verification function with the two new fields appended.
-- (Definition copied from 20260604000100; only the registry_serial /
-- registry_receipt_url columns are added to the return list + select.)
create or replace function public.verify_certificate_public(p_certificate_number text)
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
  signed_at timestamptz,
  signature_hash text,
  status text,
  registry_serial text,
  registry_receipt_url text
)
language sql
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
    c.signed_at::timestamptz,
    c.signature_hash::text,
    c.status::text,
    c.registry_serial::text,
    c.registry_receipt_url::text
  from public.certificates c
  where c.certificate_number = p_certificate_number
    and coalesce(c.status, 'active') = 'active'
  limit 1;
$$;

grant execute on function public.verify_certificate_public(text) to anon;
grant execute on function public.verify_certificate_public(text) to authenticated;

notify pgrst, 'reload schema';
