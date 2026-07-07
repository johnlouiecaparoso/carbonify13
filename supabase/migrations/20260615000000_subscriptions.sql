-- ============================================================================
-- Subscriptions / premium plans (time-boxed 30-day model)
--
-- Adds a plan dimension to profiles (orthogonal to role), a plan catalog, and
-- — critically — SERVER-SIDE enforcement so premium gating can't be bypassed
-- by calling the API directly:
--   * profiles.plan / plan_expires_at are write-protected (only service_role,
--     i.e. the PayMongo webhook, may change them).
--   * current_plan(uid) resolves the *effective* plan, treating an expired paid
--     plan as 'free'.
--   * a trigger caps Free-tier users at 3 active listings.
--   * activate_subscription() is the RPC the webhook calls after a confirmed
--     payment to grant N days of access.
-- ============================================================================

-- 1. Plan columns on profiles ------------------------------------------------
alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists plan_expires_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_plan_check;
alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro', 'business'));

-- Allow 'subscription' as a payment_intents purpose (checkout records one before
-- creating the PayMongo session, same as marketplace purchases / wallet top-ups).
alter table public.payment_intents
  drop constraint if exists payment_intents_purpose_check;
alter table public.payment_intents
  add constraint payment_intents_purpose_check
  check (purpose in ('marketplace_purchase', 'wallet_topup', 'subscription'));

-- 2. Plan catalog (authoritative prices) -------------------------------------
create table if not exists public.subscription_plans (
  key          text primary key check (key in ('pro', 'business')),
  name         text not null,
  price_minor  integer not null,          -- price in centavos (₱499.00 -> 49900)
  currency     text not null default 'PHP',
  period_days  integer not null default 30,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into public.subscription_plans (key, name, price_minor, currency, period_days)
values
  ('pro',      'Pro',      49900,  'PHP', 30),
  ('business', 'Business', 149900, 'PHP', 30)
on conflict (key) do update
  set name = excluded.name,
      price_minor = excluded.price_minor,
      currency = excluded.currency,
      period_days = excluded.period_days;

alter table public.subscription_plans enable row level security;

drop policy if exists "subscription_plans readable" on public.subscription_plans;
create policy "subscription_plans readable"
  on public.subscription_plans for select
  using (true);   -- catalog is public; writes only via service_role (bypasses RLS)

-- 3. Effective plan (expiry-aware) -------------------------------------------
create or replace function public.current_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
           when p.plan is null or p.plan = 'free' then 'free'
           when p.plan_expires_at is not null and p.plan_expires_at <= now() then 'free'
           else p.plan
         end
  from public.profiles p
  where p.id = p_user_id
$$;

-- 4. Write-protect plan columns ---------------------------------------------
-- Only the service role (PayMongo webhook / cron) may change plan or expiry.
-- Any other writer silently keeps the existing values, so a malicious client
-- UPDATE on their own profile can't grant themselves Pro.
create or replace function public.protect_plan_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.plan := old.plan;
    new.plan_expires_at := old.plan_expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_plan_columns on public.profiles;
create trigger trg_protect_plan_columns
  before update on public.profiles
  for each row execute function public.protect_plan_columns();

-- 5. Free-tier listing cap ---------------------------------------------------
-- Free users may hold at most 3 *active* user-created listings; Pro/Business are
-- unlimited. This caps `user_credit_listings` (listings a seller creates by
-- hand) — NOT `credit_listings`, which is auto-populated when a project is
-- validated (one listing per project credit); capping that would block
-- developers' marketplace listings.
--
-- NOTE: `user_credit_listings` was created manually in the live DB and is not
-- in any migration, so it may not exist yet. The trigger is therefore attached
-- defensively: it binds only if the table is present. If you create the table
-- later, re-run this migration (it is idempotent) to attach the trigger.
create or replace function public.enforce_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active integer;
begin
  if new.status is distinct from 'active' then
    return new;   -- only active listings count toward the cap
  end if;

  if public.current_plan(new.user_id) <> 'free' then
    return new;   -- paid plans: unlimited
  end if;

  select count(*) into v_active
  from public.user_credit_listings
  where user_id = new.user_id
    and status = 'active'
    and (tg_op = 'INSERT' or id <> new.id);

  if v_active >= 3 then
    raise exception 'Free plan is limited to 3 active listings. Upgrade to Pro for unlimited listings.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.user_credit_listings') is not null then
    drop trigger if exists trg_enforce_listing_limit on public.user_credit_listings;
    create trigger trg_enforce_listing_limit
      before insert or update on public.user_credit_listings
      for each row execute function public.enforce_listing_limit();
  else
    raise notice 'Skipped trg_enforce_listing_limit: table public.user_credit_listings does not exist. Re-run this migration after creating it to enforce the cap at the DB level.';
  end if;
end $$;

-- 6. Activation RPC (called by the webhook after confirmed payment) ----------
-- Grants `period_days` of access from the later of now / current expiry, so
-- buying again before expiry extends rather than resets.
create or replace function public.activate_subscription(p_user_id uuid, p_plan text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_base timestamptz;
  v_new_expiry timestamptz;
begin
  if p_plan not in ('pro', 'business') then
    raise exception 'Unknown plan: %', p_plan;
  end if;

  select period_days into v_days
  from public.subscription_plans where key = p_plan and active;
  if v_days is null then
    raise exception 'Plan % is not available', p_plan;
  end if;

  select greatest(now(), coalesce(plan_expires_at, now()))
  into v_base
  from public.profiles where id = p_user_id;

  v_new_expiry := v_base + make_interval(days => v_days);

  update public.profiles
  set plan = p_plan,
      plan_expires_at = v_new_expiry
  where id = p_user_id;

  return v_new_expiry;
end;
$$;

-- Only the service role (webhook) may activate. Clients never call this.
revoke all on function public.activate_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.activate_subscription(uuid, text) to service_role;

-- 7. Lapsed-plan sweep (optional cron) --------------------------------------
-- Normalizes expired rows back to 'free'. current_plan() already treats them as
-- free, so this is housekeeping for clean reads/reporting.
create or replace function public.expire_lapsed_plans()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.profiles
  set plan = 'free', plan_expires_at = null
  where plan <> 'free'
    and plan_expires_at is not null
    and plan_expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_lapsed_plans() from public, anon, authenticated;
grant execute on function public.expire_lapsed_plans() to service_role;
