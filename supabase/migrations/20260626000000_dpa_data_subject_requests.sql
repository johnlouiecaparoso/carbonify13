-- ============================================================================
-- DPA tooling (Phase 5) — Data Subject Requests.
--
-- The Privacy Policy we shipped promises users the right to ACCESS, EXPORT, and
-- request DELETION of their personal data (Data Privacy Act of 2012 / GDPR-style
-- data-subject rights). This table is the auditable record of those requests.
--
--   * 'export'   — a self-service data export the user ran (logged for the paper
--                  trail; the actual JSON is generated client-side from RLS-scoped
--                  reads, so no copy of personal data is stored here).
--   * 'deletion' — a request to erase the account. Capture is self-service; the
--                  actual erasure is performed by an admin / the `account-deletion`
--                  edge function (needs service-role to remove the auth user).
--
-- Owner can see and raise their own requests; admins can see and action all.
-- ============================================================================

create table if not exists public.data_subject_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  request_type  text not null check (request_type in ('export', 'deletion')),
  status        text not null default 'pending'
                  check (status in ('pending', 'in_progress', 'completed', 'cancelled', 'rejected')),
  reason        text,                 -- optional, user-supplied (esp. for deletion)
  notes         text,                 -- admin-facing processing notes
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  processed_at  timestamptz,
  processed_by  uuid references public.profiles(id) on delete set null
);

create index if not exists idx_dsr_user on public.data_subject_requests (user_id, created_at desc);
create index if not exists idx_dsr_open on public.data_subject_requests (status, request_type)
  where status in ('pending', 'in_progress');

alter table public.data_subject_requests enable row level security;

-- Owner can read their own; admins can read all.
drop policy if exists "dsr owner or admin select" on public.data_subject_requests;
create policy "dsr owner or admin select"
  on public.data_subject_requests for select
  using (user_id = auth.uid() or public.is_admin());

-- Owner raises their own requests (status/processed_* are server-controlled below).
drop policy if exists "dsr owner insert" on public.data_subject_requests;
create policy "dsr owner insert"
  on public.data_subject_requests for insert
  with check (user_id = auth.uid());

-- Owner may update their own row (used to cancel a pending deletion); admins may
-- action any row. Column-level intent is enforced by the RPCs below.
drop policy if exists "dsr owner or admin update" on public.data_subject_requests;
create policy "dsr owner or admin update"
  on public.data_subject_requests for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- Submit a request. For deletion, collapse to a single open request per user so
-- repeated clicks don't pile up. Returns the request row id.
-- ----------------------------------------------------------------------------
create or replace function public.submit_data_subject_request(
  p_type   text,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_type not in ('export', 'deletion') then
    raise exception 'invalid request type: %', p_type;
  end if;

  -- Reuse an existing open deletion request rather than creating duplicates.
  if p_type = 'deletion' then
    select id into v_id
      from public.data_subject_requests
      where user_id = v_uid and request_type = 'deletion'
        and status in ('pending', 'in_progress')
      limit 1;
    if v_id is not null then
      update public.data_subject_requests
        set reason = coalesce(p_reason, reason), updated_at = now()
        where id = v_id;
      return v_id;
    end if;
  end if;

  insert into public.data_subject_requests (user_id, request_type, reason,
    status, processed_at)
  values (v_uid, p_type, p_reason,
    -- an export is fulfilled in the same action (client downloads it), so it is
    -- recorded as completed; a deletion stays pending for admin action.
    case when p_type = 'export' then 'completed' else 'pending' end,
    case when p_type = 'export' then now() else null end)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_data_subject_request(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Owner cancels their own still-pending deletion request.
-- ----------------------------------------------------------------------------
create or replace function public.cancel_data_subject_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.data_subject_requests
    set status = 'cancelled', updated_at = now()
    where id = p_id
      and user_id = v_uid
      and status = 'pending';

  if not found then
    raise exception 'request not found or no longer cancellable';
  end if;
end;
$$;

grant execute on function public.cancel_data_subject_request(uuid) to authenticated;

notify pgrst, 'reload schema';
