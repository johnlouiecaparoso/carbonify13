-- ============================================================================
-- H1 fix: make retirement ATOMIC (burn + record in one transaction).
--
-- Previously retire_credits_atomic(uuid,uuid,numeric) returned boolean and only
-- decremented credit_ownership. The client (marketplaceService.retireCredits)
-- then inserted the credit_retirements row in a SEPARATE statement. If that
-- insert failed, the credits were already burned with no retirement record —
-- a silent loss with no audit trail and no certificate.
--
-- This version does the decrement AND the credit_retirements insert inside the
-- same SECURITY DEFINER function, so they commit or roll back together. It
-- returns the created retirement row (id + serial_number) as jsonb, or NULL when
-- there are not enough credits. The serial_number is assigned by the existing
-- credit_retirements trigger, which fires on this insert like any other.
--
-- Return type changes (boolean -> jsonb), so the old signature is dropped first.
-- ============================================================================

drop function if exists public.retire_credits_atomic(uuid, uuid, numeric);
drop function if exists public.retire_credits_atomic(uuid, uuid, numeric, text);

create or replace function public.retire_credits_atomic(
  p_user_id    uuid,
  p_project_id uuid,
  p_quantity   numeric,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid;
  v_total     numeric;
  v_remaining numeric;
  r           record;
  v_ret       public.credit_retirements%rowtype;
begin
  -- Identity comes from the authenticated session ONLY. Never fall back to the
  -- client-supplied p_user_id: with an authenticated-only grant auth.uid() is
  -- always present, and trusting p_user_id would let a caller retire another
  -- user's credits if the grant were ever widened. (This restores the hardening
  -- from 20260703000400 that an earlier draft of this file had reverted.)
  v_user := auth.uid();
  if v_user is null then
    return null;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    return null;
  end if;

  -- Total still-owned (non-retired) credits for this project.
  select coalesce(sum(quantity), 0) into v_total
  from public.credit_ownership
  where user_id = v_user
    and project_id = p_project_id
    and coalesce(status, 'owned') <> 'retired';

  if v_total < p_quantity then
    return null;
  end if;

  -- Decrement across rows, oldest first, until the requested amount is met.
  v_remaining := p_quantity;
  for r in
    select id, quantity
    from public.credit_ownership
    where user_id = v_user
      and project_id = p_project_id
      and coalesce(status, 'owned') <> 'retired'
      and quantity > 0
    order by created_at asc
    for update
  loop
    exit when v_remaining <= 0;
    if r.quantity <= v_remaining then
      update public.credit_ownership
        set quantity = 0, updated_at = now()
        where id = r.id;
      v_remaining := v_remaining - r.quantity;
    else
      update public.credit_ownership
        set quantity = quantity - v_remaining, updated_at = now()
        where id = r.id;
      v_remaining := 0;
    end if;
  end loop;

  -- Guarded impossible (v_total >= p_quantity, rows locked), but never record a
  -- partial retirement: rolling back here undoes the decrements above too.
  if v_remaining > 0 then
    raise exception 'retirement decrement did not satisfy requested quantity';
  end if;

  -- Same transaction as the burn: if this insert fails, the decrement is undone.
  insert into public.credit_retirements (user_id, project_id, quantity, reason, retired_at)
  values (v_user, p_project_id, p_quantity, p_reason, now())
  returning * into v_ret;

  return jsonb_build_object(
    'id', v_ret.id,
    'serial_number', v_ret.serial_number,
    'quantity', v_ret.quantity,
    'project_id', v_ret.project_id
  );
end;
$$;

grant execute on function public.retire_credits_atomic(uuid, uuid, numeric, text) to authenticated;

notify pgrst, 'reload schema';
