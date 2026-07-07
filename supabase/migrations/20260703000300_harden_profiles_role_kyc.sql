-- ============================================================================
-- CRITICAL security fix — prevent privilege escalation via direct profiles UPDATE
--
-- The entire admin model rests on is_admin() = (role = 'admin' on your own
-- profile row). RLS is row-level, so a permissive "update your own row" policy
-- still lets a user change ANY column on their own row — including `role` and
-- `kyc_level`. A malicious user could PATCH /rest/v1/profiles?id=eq.<self> with
-- {"role":"admin"} and become an admin (or self-grant kyc_level to bypass the
-- trade gate). The protect_plan_columns trigger only guards plan columns.
--
-- Fix (column-level privileges): remove the blanket table UPDATE from the client
-- roles and re-grant UPDATE on every column EXCEPT `role` and `kyc_level`. The
-- SECURITY DEFINER admin RPCs (assign_user_role, admin_set_user_profile,
-- review_kyc_application) run as the table OWNER and bypass column privileges,
-- so legitimate role/KYC changes through those RPCs keep working; only DIRECT
-- client writes to role/kyc_level are blocked.
--
-- Idempotent + drift-safe: enumerates the current columns, so it adapts if the
-- table shape differs. Re-run after adding new profile columns.
--
-- ⚠️ AFTER APPLYING, TEST: (1) a normal user can still edit their profile
-- (name/phone/org); (2) an admin can still change a user's role via User
-- Management; (3) a verifier/admin can still approve a role application; (4) KYC
-- approval still raises kyc_level. If any of those break, the corresponding RPC
-- is not owner-privileged as expected — tell your developer before go-live.
-- ============================================================================

do $$
declare
  v_cols text;
begin
  revoke update on public.profiles from anon;
  revoke update on public.profiles from authenticated;

  select string_agg(quote_ident(column_name), ', ')
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name not in ('role', 'kyc_level');

  if v_cols is not null then
    execute format('grant update (%s) on public.profiles to authenticated', v_cols);
  end if;
end $$;

notify pgrst, 'reload schema';
