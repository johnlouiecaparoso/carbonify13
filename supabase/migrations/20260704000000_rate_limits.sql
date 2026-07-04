-- ============================================================================
-- A9 hardening — application-level rate limiting for public edge functions.
--
-- The public paymongo-checkout function creates a PayMongo checkout session on
-- every call (a real external cost + provider load). Without a limit, a script
-- could loop it to amplify cost or grind the provider. This adds a small,
-- atomic, DB-backed fixed-window limiter the edge functions call before doing
-- expensive work.
--
-- Design: one row per limiter key (e.g. 'checkout:<user_id>'). Each hit upserts
-- the row; if the stored window has expired it resets to 1, otherwise it
-- increments. The upsert locks the row, so concurrent hits are counted
-- correctly. check_rate_limit returns TRUE when the caller is still under the
-- cap, FALSE when it should be throttled (HTTP 429).
--
-- service_role-only: the limiter is called from edge functions (service role),
-- never from the browser. Table is RLS-locked (deny-all to clients).
-- ============================================================================

create table if not exists public.rate_limit_hits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  count         integer     not null default 0,
  updated_at    timestamptz not null default now()
);

alter table public.rate_limit_hits enable row level security;
-- No policies → no client (anon/authenticated) access. service_role bypasses RLS.
revoke all on public.rate_limit_hits from anon, authenticated;

-- Atomic fixed-window check-and-increment. Returns TRUE if allowed (still under
-- p_max within the current p_window_seconds window), FALSE if the cap is hit.
create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_now   timestamptz := now();
begin
  if p_key is null or p_max is null or p_max <= 0 then
    return true; -- misconfigured caller: fail open (don't block legitimate use)
  end if;

  insert into public.rate_limit_hits as r (key, window_start, count, updated_at)
    values (p_key, v_now, 1, v_now)
  on conflict (key) do update
    set count = case
                  when r.window_start < v_now - make_interval(secs => p_window_seconds) then 1
                  else r.count + 1
                end,
        window_start = case
                  when r.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
                  else r.window_start
                end,
        updated_at = v_now
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- Optional housekeeping: prune stale limiter rows (safe to run on a schedule).
create or replace function public.prune_rate_limit_hits(p_older_than_seconds int default 86400)
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.rate_limit_hits
    where updated_at < now() - make_interval(secs => p_older_than_seconds)
    returning 1
  )
  select count(*)::int from deleted;
$$;

revoke all on function public.prune_rate_limit_hits(int) from public, anon, authenticated;
grant execute on function public.prune_rate_limit_hits(int) to service_role;

notify pgrst, 'reload schema';
