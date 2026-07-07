-- ============================================================================
-- Harden project-documents: make the bucket PRIVATE + serve via signed URLs.
--
-- Supersedes the public-read choice in 20260707000000. Developer compliance docs
-- include sensitive PII (land titles, MOAs, business permits), so they should NOT
-- be openable by anyone who happens on the URL. This flips the bucket to private
-- and grants authenticated users SELECT so they can mint short-lived SIGNED URLs
-- (verifiers, admins, and logged-in buyers reviewing evidence). Anonymous visitors
-- can no longer open raw documents — by design.
--
-- The app (storageService.getSignedProjectDocumentUrl + resolveDocumentUrls)
-- generates the signed URLs on demand from the stored object path.
-- Idempotent — safe to re-run.
-- ============================================================================

update storage.buckets set public = false where id = 'project-documents';

-- Authenticated users may read objects → required to create signed URLs.
drop policy if exists "project_documents_select" on storage.objects;
create policy "project_documents_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-documents');
