-- ============================================================================
-- Project compliance-document storage bucket.
--
-- Fixes the class of bug where a developer's required PDFs (PDD, baseline,
-- additionality, LGU endorsement, ECC, land title, MOA, …) were attached in the
-- Submit-Project form but NEVER uploaded anywhere — only their filenames were
-- persisted in projects.supporting_documents, so every download link was dead
-- and verifiers could not open the evidence they must review.
--
-- Creates a dedicated 'project-documents' bucket. It is PUBLIC-read (matching the
-- existing avatars / verifier-application-document pattern) so the stored URLs in
-- projects.supporting_documents never expire and both render sites
-- (ProjectDetailView, ProjectApprovalPanel) can link to them directly. Writes are
-- restricted to authenticated users; edits/removals to the uploading owner.
--
-- Idempotent — safe to re-run.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  true,
  26214400, -- 25 MB per file
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Authenticated users may upload into the bucket (developers submitting/editing).
drop policy if exists "project_documents_insert" on storage.objects;
create policy "project_documents_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-documents');

-- An uploader may replace/remove their own object (owner-scoped).
drop policy if exists "project_documents_update_own" on storage.objects;
create policy "project_documents_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-documents' and owner = auth.uid());

drop policy if exists "project_documents_delete_own" on storage.objects;
create policy "project_documents_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-documents' and owner = auth.uid());
