-- ============================================================================
-- Notify verifiers in-app when a project is submitted or resubmitted.
--
-- Why a trigger (not client code): system_notifications' RLS insert policy is
-- `with check (auth.uid() = user_id)`, so a developer can only create rows for
-- THEMSELVES. The client-side attempt to notify verifiers on submit/resubmit is
-- therefore rejected by RLS and the bell never rings. A SECURITY DEFINER trigger
-- runs as the table owner, bypasses RLS, and fires for every submission path
-- (the create services AND resubmitProject) uniformly.
--
-- Mirrors the existing trg_notify_project_status (which notifies the OWNER on
-- validated/needs_revision/rejected); this one notifies VERIFIERS when a project
-- enters the review queue (status submitted/pending), wording a resubmission
-- (revision_count > 0) differently from a first submission.
-- ============================================================================

create or replace function public.notify_project_submitted_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_title  text;
  v_resub  boolean;
begin
  v_status := lower(coalesce(new.status, ''));

  -- Only when the project is (re)entering the review queue.
  if v_status not in ('submitted', 'pending') then
    return new;
  end if;

  -- On UPDATE, only fire when the status actually transitioned (e.g. a resubmit
  -- from needs_revision -> submitted), not on unrelated column edits.
  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then
      return new;
    end if;
  end if;

  v_title := coalesce(new.title, 'Untitled Project');
  v_resub := coalesce(new.revision_count, 0) > 0;

  insert into public.system_notifications (user_id, type, title, message, link, metadata, is_read)
  select
    recipient.user_id,
    'project_submission',
    case when v_resub
      then format('Project resubmitted (revision %s)', new.revision_count)
      else 'New project submitted for verification' end,
    case when v_resub
      then format('Project "%s" was revised and resubmitted for review.', v_title)
      else format('Project "%s" is waiting for review.', v_title) end,
    '/verifier',
    jsonb_build_object(
      'project_id', new.id,
      'status', v_status,
      'revision_count', coalesce(new.revision_count, 0),
      'resubmission', v_resub
    ),
    false
  from public.resolve_notification_recipient_ids(
    null,                 -- no explicit target users
    array['verifier'],    -- everyone with the verifier role
    array[new.user_id]    -- but never the submitting owner
  ) as recipient;

  return new;
end;
$$;

drop trigger if exists trg_notify_project_submitted on public.projects;
create trigger trg_notify_project_submitted
after insert or update of status on public.projects
for each row
execute function public.notify_project_submitted_trigger();

notify pgrst, 'reload schema';
