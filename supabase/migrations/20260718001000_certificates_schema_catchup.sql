-- ============================================================================
-- certificates table — schema catch-up + capture into version control.
--
-- The certificates table predated version control; its live shape (dumped
-- 2026-07-11) was missing 11 columns that certificateService writes for purchase
-- AND retirement certificates, so every full insert 400'd ("creating certificate
-- with all fields" failed) and the retirement-certificate lookups
-- (…or=(retirement_id.in.(…))) 400'd because retirement_id did not exist. The
-- retirement itself is unaffected (retire_credits_atomic burns + records); only
-- the downstream certificate row failed.
--
-- This migration:
--   1) create table if not exists — the FULL certificates definition (existing 22
--      live columns) so a fresh environment rebuilds the table; a no-op on the
--      live DB where the table already exists.
--   2) adds the 11 missing columns (idempotent) so the live insert/lookup succeed.
--   3) indexes retirement_id for the certificate-by-retirement lookup.
--
-- Every column is nullable (existing rows get NULL); no data is rewritten.
-- ============================================================================

-- (1) Fresh-environment definition — mirrors the live table (no-op if it exists).
create table if not exists public.certificates (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid,
  transaction_id        uuid,
  certificate_number    text not null,
  project_title         text default 'Project Verification Certificate',
  project_category      text default 'Renewable Energy',
  project_location      text default 'Unknown Location',
  credits_quantity      integer default 0,
  vintage_year          integer default extract(year from now()),
  verification_standard  text default 'EcoLink Standard',
  issued_at             timestamptz default now(),
  expires_at            timestamptz,
  status                text default 'active',
  created_at            timestamptz default now(),
  certificate_type      text,
  beneficiary_name      text,
  signature_hash        text,
  signed_by             uuid,
  signed_at             timestamptz,
  certificate_data      jsonb,
  registry_serial       text,
  registry_receipt_url  text
);

-- (2) Columns certificateService writes that the live table lacked. Idempotent.
alter table public.certificates add column if not exists retirement_id      uuid;
alter table public.certificates add column if not exists project_description text;
alter table public.certificates add column if not exists tonnes_co2         numeric;
alter table public.certificates add column if not exists beneficiary_email  text;
alter table public.certificates add column if not exists purpose            text;
-- transaction_id_ref duplicates transaction_id; the service writes both, so keep
-- it to satisfy the insert (the redundancy is a service-layer cleanup, backlog).
alter table public.certificates add column if not exists transaction_id_ref uuid;
alter table public.certificates add column if not exists payment_reference  text;
alter table public.certificates add column if not exists wallet_address     text;
alter table public.certificates add column if not exists purchase_date      timestamptz;
alter table public.certificates add column if not exists purchase_datetime  timestamptz;
-- "timestamp" is a reserved word — quoted here and exposed to PostgREST as such.
alter table public.certificates add column if not exists "timestamp"        timestamptz;

-- (3) Retirement-certificate lookups filter certificates by retirement_id.
create index if not exists idx_certificates_retirement_id
  on public.certificates (retirement_id);

notify pgrst, 'reload schema';
