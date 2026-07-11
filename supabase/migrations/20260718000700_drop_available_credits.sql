-- ============================================================================
-- M6 consolidation, PHASE 2 of 2 — drop the stale `available_credits` stray.
--
-- `credits_available` (numeric) is the sole canonical availability column. The
-- legacy `available_credits` (integer) is not maintained by any trigger and, once
-- the frontend at this revision is deployed, is written and read by no code:
--   - projectWorkflowService / projectApprovalService insert only credits_available
--   - assetLedgerService reads only credits_available (dead fallback removed)
--   - marketplaceService no longer selects available_credits in its listing join
--
--   ▶ RUN THIS ONLY AFTER the frontend at this revision is deployed and PHASE 1
--     (20260718000600_available_credits_nullable.sql) has been applied. Dropping
--     while an older build is live would 400 that build's project_credits reads.
--
-- Note: `listings.available_credits`, `credit_listings.available_credits`, and
-- `user_credits.available_credits` are DIFFERENT tables and are unaffected.
-- ============================================================================

alter table public.project_credits drop column if exists available_credits;

notify pgrst, 'reload schema';
