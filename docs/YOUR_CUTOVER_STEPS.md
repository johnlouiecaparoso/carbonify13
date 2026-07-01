# Your steps — money-path cutover (plain, copy-paste ready)

> You do the steps **in order, top to bottom.** Don't skip ahead.
> **All the SQL you need is written directly in this document** — you just copy
> the grey boxes from here. You do **not** need to open any files for the SQL.
> If anything looks different from what's written here, **stop and ask me.**

---

## 30 seconds of "what am I even doing?"

I changed the code so money (buying credits, wallet top-ups, payouts) is handled
**on the server** instead of in the browser. To turn that on, you do 3 things:

1. **Run some SQL** — "SQL" is just database commands. You copy a grey box from
   this document, paste it into Supabase's **SQL Editor**, and click **Run**.
   (A ".sql file" is just a text file that holds that same SQL — but you don't
   need the files; I've pasted the SQL right here.)
2. **Re-upload 2 code files** ("edge functions") into Supabase and click Deploy.
3. **Test it** by buying something with a fake card.

**One rule:** after you buy / top-up / retire anything, run this in the SQL
Editor:
```sql
select * from reconcile_financials();
```
It must say **"No rows returned"** (0 rows) = the money math is balanced. If it
ever shows rows, **stop and send me a screenshot.**

**Where is the SQL Editor?** Go to **supabase.com** → log in → open your
**Carbonify project** → in the left sidebar click **SQL Editor** → click
**+ New query**. That's the box you paste SQL into and click **Run**.

---

## STEP 0 — Send me one thing (changes nothing)

In the **SQL Editor**, paste this, click **Run**, and **send me the result**:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'project_credits'
order by ordinal_position;
```

This only *reads* information — it changes nothing. Then continue.

---

## STEP 1 — Run the 2 pieces of SQL

Do these **one at a time**. For each: **+ New query** → paste the grey box →
**Run** → wait for **"Success"**.

### 1A — Wallet purchase function

Copy this whole box, paste into a new SQL query, click **Run**:

```sql
-- Server-authoritative WALLET purchase.
create or replace function public.process_wallet_purchase(
  p_listing_id uuid,
  p_quantity numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer         uuid := auth.uid();
  v_listing       public.credit_listings%rowtype;
  v_wallet        public.wallet_accounts%rowtype;
  v_pc_available  numeric;
  v_project_id    uuid;
  v_unit          numeric;
  v_amount        numeric;
  v_fee_pct       numeric := 0;
  v_fee           numeric := 0;
  v_seller_net    numeric;
  v_currency      text;
  v_ref           text := 'wallet_' || gen_random_uuid()::text;
  v_txn_id        uuid;
  v_entry         uuid := gen_random_uuid();
begin
  if v_buyer is null then
    raise exception 'authentication required';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  select * into v_listing from public.credit_listings
    where id = p_listing_id
    for update;
  if not found then
    raise exception 'listing % not found', p_listing_id;
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing is not active';
  end if;

  v_unit := v_listing.price_per_credit;
  if v_unit is null or v_unit <= 0 then
    raise exception 'listing has no valid price';
  end if;
  v_currency := coalesce(v_listing.currency, 'PHP');
  v_amount := round(v_unit * p_quantity, 2);

  select credits_available, project_id
    into v_pc_available, v_project_id
    from public.project_credits
    where id = v_listing.project_credit_id
    for update;

  if v_pc_available is null or v_pc_available < p_quantity then
    raise exception 'insufficient credits available (% < %)', coalesce(v_pc_available, 0), p_quantity;
  end if;
  if v_listing.quantity < p_quantity then
    raise exception 'insufficient listing quantity (% < %)', v_listing.quantity, p_quantity;
  end if;

  select * into v_wallet from public.wallet_accounts
    where user_id = v_buyer
    for update;
  if not found then
    raise exception 'wallet not found for buyer';
  end if;
  if coalesce(v_wallet.current_balance, 0) < v_amount then
    raise exception 'insufficient wallet balance (% < %)', coalesce(v_wallet.current_balance, 0), v_amount;
  end if;

  update public.project_credits
    set credits_available = credits_available - p_quantity, updated_at = now()
    where id = v_listing.project_credit_id;
  update public.credit_listings
    set quantity = quantity - p_quantity, updated_at = now()
    where id = v_listing.id;

  update public.wallet_accounts
    set current_balance = current_balance - v_amount, updated_at = now()
    where id = v_wallet.id;
  insert into public.wallet_transactions (
    account_id, user_id, type, amount, status, payment_method, description, reference_id
  ) values (
    v_wallet.id, v_buyer, 'withdrawal', v_amount, 'completed', 'wallet',
    'Marketplace purchase (' || p_quantity || ' credits)', v_ref
  );

  v_fee_pct := coalesce((public.get_setting('platform_fee_percent', '0'::jsonb))::text::numeric, 0);
  if v_fee_pct < 0 then v_fee_pct := 0; end if;
  if v_fee_pct > 100 then v_fee_pct := 100; end if;
  v_fee := round(v_amount * v_fee_pct / 100.0, 2);
  v_seller_net := v_amount - v_fee;

  insert into public.credit_transactions (
    listing_id, buyer_id, seller_id, project_credit_id, quantity,
    price_per_credit, total_amount, currency, payment_method, payment_reference,
    status, transaction_fee, platform_fee_percentage, completed_at, created_at, updated_at
  ) values (
    v_listing.id, v_buyer, v_listing.seller_id, v_listing.project_credit_id, p_quantity,
    v_unit, v_amount, v_currency, 'wallet', v_ref,
    'completed', v_fee, v_fee_pct, now(), now(), now()
  ) returning id into v_txn_id;

  insert into public.credit_ownership (
    user_id, project_credit_id, project_credits_id, project_id, quantity,
    purchase_price, currency, transaction_id, status, ownership_status,
    purchase_date, created_at, updated_at
  ) values (
    v_buyer, v_listing.project_credit_id, v_listing.project_credit_id, v_project_id, p_quantity,
    v_unit, v_currency, v_txn_id, 'active', 'owned',
    now(), now(), now()
  );

  insert into public.ledger_entries (entry_id, account, direction, amount, currency, ref_type, ref_id, description)
    values (v_entry, 'wallet_float', 'debit', v_amount, v_currency, 'purchase', v_txn_id::text, 'Wallet-funded marketplace purchase');
  if v_seller_net > 0 then
    insert into public.ledger_entries (entry_id, account, direction, amount, currency, ref_type, ref_id, description)
      values (v_entry, 'seller_payable:' || v_listing.seller_id::text, 'credit', v_seller_net, v_currency, 'purchase', v_txn_id::text, 'Seller proceeds (wallet)');
  end if;
  if v_fee > 0 then
    insert into public.ledger_entries (entry_id, account, direction, amount, currency, ref_type, ref_id, description)
      values (v_entry, 'platform_revenue', 'credit', v_fee, v_currency, 'purchase', v_txn_id::text, 'Platform fee (wallet)');
  end if;

  return v_txn_id;
end;
$$;

revoke all on function public.process_wallet_purchase(uuid, numeric) from public, anon;
grant execute on function public.process_wallet_purchase(uuid, numeric) to authenticated, service_role;

notify pgrst, 'reload schema';
```

✅ It should say **"Success. No rows returned"** — that's correct.

### 1B — Wallet creation function

Now **+ New query** again, paste this box, click **Run**:

```sql
-- Server-side wallet creation.
create or replace function public.ensure_wallet()
returns table(id uuid, user_id uuid, current_balance numeric, currency text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  if not exists (select 1 from public.wallet_accounts wa where wa.user_id = v_user) then
    begin
      insert into public.wallet_accounts (user_id, current_balance, currency)
        values (v_user, 0, 'PHP');
    exception when unique_violation then
      null;
    end;
  end if;

  return query
    select wa.id, wa.user_id, wa.current_balance, wa.currency
    from public.wallet_accounts wa
    where wa.user_id = v_user;
end;
$$;

revoke all on function public.ensure_wallet() from public, anon;
grant execute on function public.ensure_wallet() to authenticated, service_role;

notify pgrst, 'reload schema';
```

✅ Again "Success. No rows returned" is correct.

### 1C — Confirm both installed

**+ New query**, paste, **Run** — you should get **2 rows** back:

```sql
select proname from pg_proc
where proname in ('process_wallet_purchase', 'ensure_wallet');
```

If you see the two names → **Step 1 done.** ✅

---

## STEP 2 — Re-upload the 2 edge functions

These two are **code files**, not SQL — they're too long to paste here, so for
these you copy from the file in VS Code.

### 2A — `paymongo-checkout`
1. Supabase left sidebar → **Edge Functions** → click **`paymongo-checkout`**.
2. In VS Code, open the file
   **`supabase/functions/paymongo-checkout/index.ts`** (use `Ctrl+P`, type
   `paymongo-checkout`, pick `index.ts`). Select all (`Ctrl+A`), copy (`Ctrl+C`).
3. In Supabase's code box for that function: delete the old code, paste the new,
   click **Deploy**. If asked about **"Verify JWT"**, keep it **OFF**.

### 2B — `paymongo-webhook`
Same steps, for the function **`paymongo-webhook`** using the file
**`supabase/functions/paymongo-webhook/index.ts`**.

> No passwords/secrets to add. If you can't find the code box in Supabase, send
> me a screenshot of the Edge Functions page and I'll point to it.

---

## STEP 3 — Put the app on a test website (preview)

We test on a real web address because the fake card can't reach your laptop.

1. In the VS Code terminal: `git push`
2. Create a **preview** deploy on Vercel (does **not** touch your live site):
   `vercel deploy`
3. Open the preview URL it prints, and log in with a test buyer account.

> Stuck on `git push` / `vercel`? Tell me — I'll paste the exact commands.

---

## STEP 4 — Test each money action

Fake test card: **`4343 4343 4343 4345`**, any future expiry (e.g. 12/30), any
3-digit CVC.

**After EACH test**, run `select * from reconcile_financials();` in the SQL
Editor → must be **0 rows**.

- [ ] **A. Buy with Card.** Marketplace → Buy a listing → **Credit/Debit Card** →
      pay. Check: credits in portfolio + certificate/receipt made → reconcile = 0.
- [ ] **B. Top up wallet.** Wallet → Top up → pay. Check: balance went up →
      reconcile = 0.
- [ ] **C. Buy with Wallet.** Marketplace → Buy → **Wallet Balance** → completes
      instantly. Check: balance dropped, credits added → reconcile = 0.
- [ ] **D. Cart, 2 items.** Add 2 listings → checkout → pays one at a time →
      reconcile = 0.
- [ ] **E. Retire credits.** Retire some you own → owned amount drops, retirement
      certificate made.
- [ ] **F. Subscription.** `/upgrade` → pay → plan becomes Pro.

**All 6 green + reconcile always 0 → message me "Step 4 all green."** Don't do
Step 6 yet.

---

## STEP 5 — I check, then say go/no-go

After "Step 4 all green," I review the code once more and tell you it's safe to
lock.

---

## STEP 6 — Lock the tables (LAST, only after I say go)

**+ New query**, paste this box, **Run**:

```sql
-- Make the financial tables server-write-only.
do $$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('credit_transactions', 'credit_ownership', 'wallet_accounts', 'wallet_transactions')
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.credit_transactions  enable row level security;
alter table public.credit_ownership      enable row level security;
alter table public.wallet_accounts       enable row level security;
alter table public.wallet_transactions   enable row level security;
```

Then **redo the whole Step 4 test list once more.** Everything must still work
and reconcile must still be 0. If anything breaks, tell me — it's reversible.

---

## If you get stuck
Tell me the **step number** and **what you see** (screenshot or error text).
Don't continue past a `reconcile_financials()` that shows rows — send me the rows.
