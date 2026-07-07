-- ============================================================================
-- Drift fix: credit_ownership quantity constraint (> 0  ->  >= 0)
--
-- Retirement (retire_credits_atomic) fully retires an ownership row by setting
-- its quantity to 0. The intended guard is credit_ownership_qty_nonneg
-- (quantity >= 0), added by 20260604020100_retirement_integrity.sql. But the
-- live DB — where credit_ownership predates version control — carries an older,
-- stray constraint `credit_ownership_quantity_positive` (quantity > 0) that
-- rejects 0, so every retirement fails with:
--   new row for relation "credit_ownership" violates check constraint
--   "credit_ownership_quantity_positive"
--
-- This drops the stray > 0 constraint and (re)asserts the intended >= 0 guard,
-- validated. Existing rows are all >= 1 (the old constraint guaranteed it), so
-- validation is safe. Idempotent.
-- ============================================================================

alter table public.credit_ownership
  drop constraint if exists credit_ownership_quantity_positive;

-- Re-assert the intended non-negative guard as a VALID constraint (the
-- retirement-integrity migration added it NOT VALID; recreate it validated so
-- it actually enforces going forward while still permitting 0).
alter table public.credit_ownership
  drop constraint if exists credit_ownership_qty_nonneg;
alter table public.credit_ownership
  add constraint credit_ownership_qty_nonneg check (quantity >= 0);

notify pgrst, 'reload schema';
