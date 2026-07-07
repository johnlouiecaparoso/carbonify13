-- ============================================================================
-- Phase 5 — Seed tax/identity settings for VAT invoices.
--
-- The VAT invoice generator reads these from app_settings (admin-editable in
-- System Config); it falls back to placeholders when absent, so this seed is
-- optional but makes the values configurable. Update them once Carbonify is a
-- BIR-registered entity. Won't clobber values an admin has already set.
-- ============================================================================

insert into public.app_settings (key, value, description) values
  ('vat_rate', '12'::jsonb,
    'VAT rate (%) applied to marketplace sales on the VAT invoice. PH standard = 12.'),
  ('company_name', '"Carbonify (pre-production)"'::jsonb,
    'Registered name shown on VAT invoices. Set to the BIR-registered entity name.'),
  ('company_tin', '"TIN: ___-___-___-___"'::jsonb,
    'Seller Tax Identification Number shown on VAT invoices.'),
  ('company_address', '"Registered address not yet configured"'::jsonb,
    'Registered business address shown on VAT invoices.'),
  ('company_business_style', '"Carbon credit marketplace"'::jsonb,
    'Business style / line of business shown on VAT invoices.')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
