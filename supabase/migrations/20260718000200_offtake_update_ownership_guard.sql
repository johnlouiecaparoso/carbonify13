-- ============================================================================
-- H5 fix: the offtake UPDATE policy must re-check project ownership.
--
-- 20260713000000 guards INSERT doubly (developer_id = auth.uid() AND you own the
-- project), with a comment that without the project check "a developer could
-- attach an agreement to someone else's project and inflate its contracted
-- revenue." But the UPDATE policy only checked `developer_id = auth.uid()` and
-- left project_id freely mutable. A developer could insert a signed agreement on
-- their own validated project (passing the insert guard), then UPDATE project_id
-- to a RIVAL's validated project. offtake_summary() is SECURITY DEFINER and joins
-- projects only on status='validated' with no ownership filter, so the rival's
-- project would then report fabricated contracted revenue / downside IRR in the
-- Investor Portal — exactly the threat the insert guard exists to prevent.
--
-- This mirrors the insert's project-ownership check into the update WITH CHECK,
-- so the post-update row must still point at a project the developer owns.
-- ============================================================================

drop policy if exists "offtake owner update" on public.offtake_agreements;
create policy "offtake owner update"
  on public.offtake_agreements for update
  using (developer_id = auth.uid())
  with check (
    developer_id = auth.uid()
    and exists (
      select 1 from public.projects p
       where p.id = project_id and p.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
