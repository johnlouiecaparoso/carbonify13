-- ============================================================================
-- Promote a user to the `farmer` role. Run in the Supabase SQL Editor.
--
-- WHY THIS WORKS FROM THE SQL EDITOR BUT NOT FROM THE APP:
-- Migration #17 (20260703000300_harden_profiles_role_kyc.sql) revoked column-level
-- UPDATE on `profiles.role` from `authenticated`/`anon`, so no client can change
-- a role directly — that was the privilege-escalation fix. The SQL Editor runs as
-- the table owner, which bypasses column privileges. This is the intended
-- back door for an operator, not a hole.
--
-- PREFER THE APP when you can: Admin → User Management → edit user → Role =
-- Farmer. That path goes through `assign_user_role()`, which writes an audit-log
-- entry. This script does not.
-- ============================================================================

-- ── STEP 1. Find the user. Replace the email. ───────────────────────────────
-- Run this ALONE first and confirm exactly one row comes back. If zero rows,
-- the account doesn't exist yet — sign up first.
select id, email, full_name, role, created_at
from public.profiles
where lower(email) = lower('farmer@example.com');


-- ── STEP 2. Promote them. ───────────────────────────────────────────────────
-- Scoped by email, and guarded so it can only ever touch ONE row.
do $$
declare
  v_email text := 'farmer@example.com';   -- ← change this
  v_id    uuid;
  v_old   text;
begin
  select id, role into v_id, v_old
  from public.profiles
  where lower(email) = lower(v_email);

  if v_id is null then
    raise exception 'No profile with email %. Sign up first.', v_email;
  end if;

  if v_old = 'farmer' then
    raise notice 'Already a farmer — nothing to do.';
    return;
  end if;

  -- Refuse to silently demote an admin. If you really mean it, do it by hand.
  if v_old = 'admin' then
    raise exception 'Refusing to demote an admin (%). Do it deliberately.', v_email;
  end if;

  update public.profiles set role = 'farmer' where id = v_id;
  raise notice 'Promoted % from % to farmer.', v_email, v_old;
end $$;


-- ── STEP 3. Verify. Expect exactly one row, role = farmer. ──────────────────
select id, email, role
from public.profiles
where lower(email) = lower('farmer@example.com');


-- ============================================================================
-- AFTER RUNNING: the user must SIGN OUT AND BACK IN.
-- The role is cached in the Pinia user store from the profile fetched at login;
-- it will not change under a live session. On next sign-in they should land on
-- /farmer.
--
-- If they land on /home instead, the profile fetch didn't pick up the new role —
-- hard-refresh, then check `select role from profiles where id = auth.uid();`
-- from their own session.
-- ============================================================================


-- ── Bonus: promote several at once ─────────────────────────────────────────
-- update public.profiles
--    set role = 'farmer'
--  where lower(email) in ('a@example.com', 'b@example.com')
--    and role not in ('admin', 'farmer');


-- ── Bonus: who is a farmer right now? ──────────────────────────────────────
-- select email, full_name, created_at from public.profiles
--  where role = 'farmer' order by created_at desc;
