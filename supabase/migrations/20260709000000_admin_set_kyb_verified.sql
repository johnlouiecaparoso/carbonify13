-- ============================================================================
-- Admin manual KYB override.
--
-- Today `profiles.kyb_verified` can only be flipped as a side-effect of approving
-- an existing `kyb_applications` row (review_kyb_application). That leaves no way
-- for an admin to verify a developer who never submitted a KYB application — so
-- their "Business verification required" gate (e.g. Sell Feedstock) can't be
-- cleared. This adds a direct, admin-gated setter, mirroring
-- `admin_set_user_profile` (the KYC-level override).
--
-- Also closes a self-grant hole: the profiles hardening migration
-- (20260703000300) re-granted per-column UPDATE to `authenticated` for every
-- column except role/kyc_level — which left `kyb_verified` client-writable on a
-- user's OWN row. Revoke it so users can't self-verify; writes now go only
-- through the SECURITY DEFINER RPCs (this one + review_kyb_application).
-- Idempotent; safe to re-run.
-- ============================================================================

-- Stop users self-setting their own kyb_verified via a raw PATCH.
revoke update (kyb_verified) on public.profiles from authenticated;

create or replace function public.admin_set_kyb_verified(
  p_user_id uuid,
  p_verified boolean
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'only administrators can set KYB verification';
  end if;

  update public.profiles
     set kyb_verified = coalesce(p_verified, false)
   where id = p_user_id
   returning * into v_profile;

  if not found then
    raise exception 'user not found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.admin_set_kyb_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_kyb_verified(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
