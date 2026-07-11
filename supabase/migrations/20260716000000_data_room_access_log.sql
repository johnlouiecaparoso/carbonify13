-- ============================================================================
-- Investor data room — access log. Closes expansion #5's last bullet.
--
-- The Investor Portal showed a document COUNT badge and linked out to the project
-- page. A data room is not a link: it is documents you can open in context, and a
-- record of who opened them. Developers raising capital need to know which
-- investors read their PDD; investors expect their diligence to be logged.
--
-- ── Why a SECURITY DEFINER RPC and not an INSERT policy ────────────────────
-- Both parties on a log row must be trustworthy. With a plain INSERT policy the
-- client supplies `developer_id`, so an investor could write access rows against
-- a project that isn't theirs, or forge a viewer. `log_data_room_access()` derives
-- BOTH: the viewer from auth.uid(), the developer from projects.user_id. The
-- client only names the project and the document.
--
-- A developer viewing their own documents is NOT logged — self-views would drown
-- the signal the log exists to provide.
--
-- Additive + idempotent + drift-safe. Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.data_room_access_log (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  developer_id  uuid not null references public.profiles(id) on delete cascade,
  viewer_id     uuid not null references public.profiles(id) on delete cascade,
  document_name text not null,
  action        text not null default 'view' check (action in ('view', 'download')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_data_room_developer
  on public.data_room_access_log (developer_id, created_at desc);
create index if not exists idx_data_room_project
  on public.data_room_access_log (project_id, created_at desc);

alter table public.data_room_access_log enable row level security;

-- The developer whose documents were read, the investor who read them, and admins.
-- Nobody else: one investor must not see which rivals are doing diligence.
drop policy if exists "data_room_access party select" on public.data_room_access_log;
create policy "data_room_access party select"
  on public.data_room_access_log for select
  using (developer_id = auth.uid() or viewer_id = auth.uid() or public.is_admin());

-- Intentionally NO insert/update/delete policy: writes go through the RPC below,
-- so neither identity on a row can be forged, and a log entry can never be erased
-- by the person it incriminates.

create or replace function public.log_data_room_access(
  p_project_id uuid,
  p_document_name text,
  p_action text default 'view'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_developer uuid;
  v_status    text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if p_action not in ('view', 'download') then
    raise exception 'Unknown action';
  end if;

  select user_id, status into v_developer, v_status
    from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;

  -- Only the validated pipeline is an investor-facing data room.
  if v_status <> 'validated' then
    return;
  end if;

  -- A developer reading their own documents is not diligence. Skip silently so
  -- the log stays a record of external interest.
  if v_developer = auth.uid() then
    return;
  end if;

  insert into public.data_room_access_log (project_id, developer_id, viewer_id, document_name, action)
  values (p_project_id, v_developer, auth.uid(), coalesce(nullif(btrim(p_document_name), ''), 'document'), p_action);
end;
$$;

revoke all on function public.log_data_room_access(uuid, text, text) from public, anon;
grant execute on function public.log_data_room_access(uuid, text, text) to authenticated;

comment on table public.data_room_access_log is
  'Who opened which project document in the Investor Portal data room (expansion #5). Written only via log_data_room_access(); self-views are not recorded.';

notify pgrst, 'reload schema';
