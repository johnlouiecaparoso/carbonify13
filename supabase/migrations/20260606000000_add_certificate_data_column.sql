-- Add the certificate_data JSONB column the certificate service reads/writes.
--
-- Background: 20260604000100_add_certificate_verification.sql already adds
-- certificate_type (and several optional columns), but certificate_data is
-- referenced by the app yet was never created in any migration. The console
-- error "Could not find the 'certificate_data' column of 'certificates' in the
-- schema cache" comes from this gap (the certificate_type half of that error is
-- resolved simply by APPLYING the pending migrations to the live project).
--
-- This is additive and idempotent: a no-op when the column already exists.

alter table public.certificates
  add column if not exists certificate_data jsonb;

comment on column public.certificates.certificate_data is
  'Flexible JSONB payload for certificate fields not promoted to dedicated columns.';
