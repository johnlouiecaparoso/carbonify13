-- ============================================================================
-- Close 3 live RLS holes on the credit-integrity tables (backlog #13).
--
-- A pg_policies audit of the live DB (2026-07-11) found the four ledger tables
-- (credit_ownership, wallet_accounts, wallet_transactions, credit_transactions)
-- already correctly SELECT-only for clients — good. But three tables carried
-- client-writable policies that are directly exploitable:
--
--   1. project_credits — policy "Allow all project credits operations" is
--      USING(true) WITH CHECK(true) FOR ALL. Any authenticated user could UPDATE
--      credits_available and mint inventory they don't own.
--   2. credit_listings — policy "Allow all credit listings operations" is
--      USING(true) WITH CHECK(true) FOR ALL. Any authenticated user could UPDATE
--      ANY listing's price_per_credit. Checkout recomputes the charge from that
--      column, so this defeats server-authoritative pricing (set a listing to
--      ₱0.01, buy real credits for nothing).
--   3. credit_retirements — a client INSERT policy (WITH CHECK user_id=auth.uid())
--      let a user forge a retirement row (and its certificate) with no burn.
--
-- Why locking these down is SAFE (no legitimate client flow depends on the blanket
-- policies):
--   - Issuance is a SECURITY DEFINER trigger (activate_validated_project_trigger,
--     20260602001000) — runs as the function owner, RLS-exempt.
--   - The purchase decrement of credits_available runs in process_marketplace_purchase
--     / process_wallet_purchase as service_role — RLS-exempt.
--   - Retirement is written by retire_credits_atomic (SECURITY DEFINER) — RLS-exempt.
--   - Sellers keep full control of their OWN listings via sellers_manage_own_listings;
--     staff keep all via admins_manage_all_listings + the staff INSERT/UPDATE policies.
--   - The client generate*() functions that used to write these tables directly
--     (projectWorkflowService.generateProjectCredits, projectApprovalService.
--     generateCreditsForProject, marketplaceService.updateMarketplaceAvailabilityAfterPurchase)
--     are dead — zero callers at this revision.
--
--   ▶ Apply, then IMMEDIATELY verify the full flow (validate a project → a listing +
--     pool appear → buy → retire) per RUNTIME_VERIFICATION_RUNBOOK. Rollback if a flow
--     breaks is at the bottom of this file.
-- ============================================================================

-- Belt-and-suspenders: ensure RLS is on (it already is — the app relies on these
-- policies — but a fresh env must rebuild locked). NOT forced, so the SECURITY
-- DEFINER issuance trigger and service_role RPCs keep bypassing RLS as intended.
alter table public.project_credits    enable row level security;
alter table public.credit_listings    enable row level security;
alter table public.credit_retirements enable row level security;

-- (1) project_credits — drop the blanket write policy. Staff-only INSERT/UPDATE
-- remain ("Project Credits INSERT Policy" / "Project Credits UPDATE Policy",
-- is_admin OR is_verifier). Developers can no longer set their own credits_available.
drop policy if exists "Allow all project credits operations" on public.project_credits;

-- Preserve project-deletion / admin cleanup (DELETE is not a mint vector): allow the
-- project owner or an admin to delete a project's pool rows. There was previously no
-- non-blanket DELETE policy, so this keeps projectService project-deletion working.
drop policy if exists "project_credits_owner_or_admin_delete" on public.project_credits;
create policy "project_credits_owner_or_admin_delete" on public.project_credits
  for delete to authenticated
  using (
    is_admin(auth.uid())
    or project_id in (select id from public.projects where user_id = auth.uid())
  );

-- (2) credit_listings — drop the blanket write policy. sellers_manage_own_listings
-- (ALL, seller_id=auth.uid()), admins_manage_all_listings, and the staff INSERT
-- policy remain, so every legitimate write (seller manages own; staff/approval;
-- issuance trigger) still succeeds. Cross-user price tampering is now blocked.
drop policy if exists "Allow all credit listings operations" on public.credit_listings;

-- (3) credit_retirements — drop the forgeable client INSERT. retire_credits_atomic
-- (SECURITY DEFINER) writes the row; no client INSERT path is needed.
drop policy if exists "Users can insert their own retirements" on public.credit_retirements;

notify pgrst, 'reload schema';

-- ============================================================================
-- ROLLBACK (only if a legitimate flow breaks and you must restore immediately):
--
--   create policy "Allow all project credits operations" on public.project_credits
--     for all using (true) with check (true);
--   create policy "Allow all credit listings operations" on public.credit_listings
--     for all using (true) with check (true);
--   create policy "Users can insert their own retirements" on public.credit_retirements
--     for insert with check (user_id = auth.uid());
--   drop policy if exists "project_credits_owner_or_admin_delete" on public.project_credits;
--   notify pgrst, 'reload schema';
--
-- Then tell me which flow broke — it means a live caller writes one of these tables
-- as a non-staff, non-owner user, which is itself worth understanding before re-locking.
-- ============================================================================
