-- ============================================================================
-- M3 fix: an admin approving a KYC application must not silently grant a tier the
-- applicant chose for themselves.
--
-- review_kyc_application set profiles.kyc_level = v_app.level_requested with no
-- clamp, and level_requested has no CHECK constraint and is never validated on
-- submit. A user could submit level_requested = 3 (the admin-only "Enhanced"
-- tier) — or an arbitrary large integer — and an admin clicking "Approve",
-- believing they granted basic verification, would over-clear any
-- min_kyc_level_to_trade gate. admin_set_user_profile already clamps to [0,3];
-- this brings the approval path in line.
--
-- Self-service applications are capped at tier 2 here: tier 3 is granted only by
-- an admin explicitly, via admin_set_user_profile, never by approving a
-- self-submitted application.
-- ============================================================================

-- Backstop the column so no path can persist an out-of-range request.
alter table public.kyc_applications
  drop constraint if exists kyc_level_requested_range;
alter table public.kyc_applications
  add constraint kyc_level_requested_range
  check (level_requested between 1 and 3) not valid;

create or replace function public.review_kyc_application(
  p_application_id uuid,
  p_approve boolean,
  p_notes text default ''
)
returns public.kyc_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.kyc_applications;
  v_level integer;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can review KYC applications';
  end if;

  update public.kyc_applications
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        review_notes = p_notes
  where id = p_application_id
  returning * into v_app;

  if v_app.id is null then
    raise exception 'KYC application not found';
  end if;

  if p_approve then
    -- Clamp: approving a self-submitted application grants at most tier 2.
    -- Tier 3 is admin-only, granted explicitly via admin_set_user_profile.
    v_level := least(greatest(coalesce(v_app.level_requested, 1), 1), 2);
    update public.profiles
      set kyc_level = v_level
    where id = v_app.user_id;
  end if;

  return v_app;
end;
$$;

grant execute on function public.review_kyc_application(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';
