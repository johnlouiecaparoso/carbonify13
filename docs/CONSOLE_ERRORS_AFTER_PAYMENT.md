# Console errors after payment (PayMongo callback)

> ✅ **Historical (2026-07-03).** The post-payment console errors documented here were **resolved**
> (schema drift fixed; FKs/columns added). Kept for traceability. Current status:
> **[HANDOFF.md](HANDOFF.md)** · **[GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md)**.

After a successful payment you may see several console messages. Here’s what they mean and how to fix them.

---

## 1. Credit ownership: “record 'new' has no field 'updated_at'” (fixable)

**What you see:**
- `Failed to load resource: 400` on `credit_ownership?id=eq....`
- `⚠️ updated_at column not found, updating without it`
- `❌ Error adding credits to portfolio: Failed to update credit ownership: record "new" has no field "updated_at"`
- `⚠️ CRITICAL: Purchase payment succeeded but credits not added to portfolio`

**Cause:**  
The `credit_ownership` table has a **database trigger** that runs on `UPDATE` and sets `NEW.updated_at`, but the table has no `updated_at` column, so the trigger fails.

**Fix (one-time in Supabase):**

1. Open your Supabase project → **SQL Editor**.
2. Run this (or apply the migration file):

```sql
ALTER TABLE credit_ownership
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
```

Or run the migration file:

- `supabase/migrations/20260215000000_fix_credit_ownership_updated_at.sql`

After this, updating credit ownership (e.g. adding credits to an existing portfolio row) will succeed and credits will show in the portfolio.

---

## 2. credit_transactions 400 on select

**What you see:**  
`Failed to load resource: 400` on  
`credit_transactions?select=*%2Cproject_credits%21inner%28...%29%2Cbuyer%3Aprofiles%21...`

**Cause:**  
The receipt/certificate code does a **joined select** on `credit_transactions` (e.g. with `profiles` via `credit_transactions_buyer_id_fkey`). The 400 usually means:

- The foreign key name in the join doesn’t match your schema, or  
- RLS or schema cache doesn’t allow that query.

**Effect:**  
- “Transaction not found” in receipts.  
- Certificates still work because they fall back to separate queries.

**Fix (optional):**  
In Supabase, check that:

- `credit_transactions` has FKs to `profiles` (e.g. `buyer_id`, `seller_id`).
- The relationship names used in the app match the FK names in the schema.  
Adjust the select/join in `receiptService.js` (and any similar code) to use the correct relation names, or keep using the certificate fallback if that’s enough.

---

## 3. generateReceipt: “Transaction not found”

**What you see:**  
`Error in generateReceipt: Error: Transaction not found`

**Cause:**  
The receipt service loads the transaction with the same joined query that returns 400 (see #2). So the transaction isn’t “found” by that query.

**Fix:**  
Fix the `credit_transactions` select/join (see #2), or implement a fallback in the receipt service that loads the transaction with a simpler query (e.g. by id only) when the joined query fails.

---

## 4. certificateService: “Could not find a relationship between 'credit_transactions' and 'profiles'”

**What you see:**  
`⚠️ Join query failed, trying separate queries... Could not find a relationship between 'credit_transactions' and 'profiles' in the schema cache`

**Cause:**  
The certificate code first tries a join from `credit_transactions` to `profiles`. Your schema (or schema cache) doesn’t expose that relationship under the name the code uses.

**Effect:**  
None for users: the code falls back to “separate queries” and still loads transaction and buyer, and certificates are created successfully (“Certificate created (attempt 3/4)” etc.).

**Fix (optional):**  
To remove the warning, define or rename the FK relationship in Supabase so it matches what the certificate service expects, or change the service to use the relationship name your schema actually has.

---

## 5. wallet_accounts 400

**What you see:**  
`Failed to load resource: 400` on  
`wallet_accounts?select=wallet_address&user_id=eq....`

**Cause:**  
Query filters by `user_id`. Common causes:

- Column is named differently (e.g. `owner_id`).
- RLS blocks the select for the current user.

**Fix:**  
Check the `wallet_accounts` table: column name and RLS policies. Use the correct column in the query and ensure the authenticated user is allowed to read their row.

---

## 6. certificates 400 and “certificate_type” / “certificate_data” not found

**What you see:**  
- `Failed to load resource: 400` on `certificates?select=*`
- `Could not find the 'certificate_type' column of 'certificates' in the schema cache`
- `Could not find the 'certificate_data' column of 'certificates' in the schema cache`

**Cause:**  
The certificate service tries to select or write columns (`certificate_type`, `certificate_data`) that don’t exist on your `certificates` table.

**Effect:**  
Certificates are still created via a fallback that doesn’t use those columns (“Certificate created (attempt 3/4)”, “Certificate generated successfully!”).

**Fix (optional):**  
To remove warnings and use full schema:

- Add the missing columns to `certificates` in Supabase, or  
- Change the certificate service to only use columns that exist in your schema.

---

## Summary

| Issue                         | User impact              | Fix |
|------------------------------|---------------------------|-----|
| credit_ownership updated_at  | Credits not added to portfolio | Run the SQL above (add `updated_at` to `credit_ownership`) |
| credit_transactions 400      | Receipt “Transaction not found” | Fix join/relationship or add fallback query |
| Receipt “Transaction not found” | Receipt may not generate   | Same as above |
| credit_transactions ↔ profiles | None (fallback works)     | Optional: fix relationship name |
| wallet_accounts 400          | Possible wallet display issues | Fix column name / RLS |
| certificate_type / certificate_data | None (fallback works) | Optional: add columns or adjust code |

The only one that directly prevents credits from appearing in the portfolio after payment is **#1**. Run the migration or SQL once in Supabase to fix it.
