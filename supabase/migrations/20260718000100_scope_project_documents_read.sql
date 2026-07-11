-- ============================================================================
-- H3 fix: scope reads of the private project-documents bucket.
--
-- 20260707000100 flipped the bucket to private but granted BLANKET SELECT to
-- every authenticated user: `using (bucket_id = 'project-documents')`. With open
-- signup, any throwaway account could `list` the bucket and mint signed URLs for
-- ANY object — including developer compliance PII (land titles, MOAs, permits)
-- that is never surfaced in the app UI. That is a bulk-enumeration data leak.
--
-- The app legitimately shows a project's *declared* documents (supporting_documents)
-- to buyers/investors on the project page and in the data room, so we cannot
-- simply lock the bucket to owners. This policy keeps that flow working while
-- closing the leak: a signed-in user may read an object only if
--   (a) they own it (their uid is the first path segment), or
--   (b) they are an admin or verifier (review), or
--   (c) the object is referenced by the supporting_documents of a VALIDATED
--       project (i.e. a document the developer chose to publish).
--
-- Residual risk (documented, follow-up): a developer who attaches a sensitive
-- doc to a validated project's supporting_documents still publishes it under (c).
-- The complete fix is to split public project documents from private compliance
-- PII into two buckets; tracked in DEFERRED_BACKLOG.md.
-- ============================================================================

drop policy if exists "project_documents_select" on storage.objects;
create policy "project_documents_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      -- (a) owner: objects are stored under `<uid>/<label_ts_rand.ext>`
      (storage.foldername(name))[1] = auth.uid()::text
      -- (b) reviewers
      or exists (
        select 1 from public.profiles pr
        where pr.id = auth.uid() and pr.role in ('admin', 'verifier')
      )
      -- (c) a document published by a validated project
      or exists (
        select 1 from public.projects p
        where p.status = 'validated'
          and p.supporting_documents::text like '%' || name || '%'
      )
    )
  );

notify pgrst, 'reload schema';
