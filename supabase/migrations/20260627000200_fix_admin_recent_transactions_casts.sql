-- ============================================================================
-- Fix — admin_recent_transactions() 42804
--   "structure of query does not match function result type"
--
-- The function declares numeric/text/timestamptz output columns, but its body
-- selected the raw `credit_transactions` columns with NO casts. PostgreSQL's
-- RETURN QUERY is strict: the body's column types must match the declared
-- RETURNS TABLE types EXACTLY (no implicit coercion). On a drifted DB where,
-- e.g., `quantity` is integer (not numeric), the function raises 42804 at call
-- time and the Finance Console RPC 400s.
--
-- Fix: cast every projected column to its declared type so the body always
-- matches the signature regardless of the underlying column types. Drop first
-- in case the live declaration itself drifted (create-or-replace can't change
-- a function's return columns). Read-only, admin-gated function — safe to drop.
-- ============================================================================

drop function if exists public.admin_recent_transactions(integer);

create function public.admin_recent_transactions(p_limit int default 50)
returns table (
  id uuid,
  created_at timestamptz,
  buyer_name text,
  seller_name text,
  quantity numeric,
  total_amount numeric,
  transaction_fee numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
    select
      ct.id,
      ct.created_at::timestamptz,
      coalesce(bp.full_name, 'Unknown')::text,
      coalesce(sp.full_name, 'Unknown')::text,
      ct.quantity::numeric,
      ct.total_amount::numeric,
      coalesce(ct.transaction_fee, 0)::numeric,
      ct.status::text
    from public.credit_transactions ct
    left join public.profiles bp on bp.id = ct.buyer_id
    left join public.profiles sp on sp.id = ct.seller_id
    order by ct.created_at desc
    limit greatest(coalesce(p_limit, 50), 1);
end;
$$;

revoke all on function public.admin_recent_transactions(int) from public, anon;
grant execute on function public.admin_recent_transactions(int) to authenticated;

notify pgrst, 'reload schema';
