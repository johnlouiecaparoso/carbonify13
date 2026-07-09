# Runtime Verification Runbook — the seven expansion features

> **Written:** 2026-07-09 · **Why:** all 31 migrations are applied and 312 unit tests pass, but
> **none of the expansion features has been exercised against the live database.** Unit tests prove
> the pure math. They prove nothing about RLS policies, RPC grants, or whether a column the code
> selects actually exists.
>
> **How to use this.** Work top to bottom. Each step states **what to click**, **what you should
> see**, and **what it means if you don't**. When something fails, the "if it fails" line tells you
> which layer broke — so you don't debug the UI when the problem is a policy.
>
> ⚠️ **Do this on the Vercel preview, not localhost.** Nothing here needs PayMongo, but the storage
> signed-URLs and RLS behave like production only against the real Supabase project.

---

## 0. Accounts you'll need

Create these once. Sign-up works because email confirmation is off (see HANDOFF — accepted risk).

| Alias | Role | How to get it |
|---|---|---|
| **DEV** | `project_developer` | sign up → admin sets role in User Management |
| **FARMER** | `farmer` | sign up → apply at `/apply?role=farmer` → **admin** approves |
| **INVESTOR** | `buyer_investor` + **Pro plan** | sign up → admin sets role → `/upgrade` to Pro |
| **VERIFIER** | `verifier` | sign up → admin sets role |
| **ADMIN** | `admin` | you already have one |

> **First thing to check:** the Farmer role exists at all. In Admin → User Management → edit a user,
> the Role dropdown must now list **Farmer**, **Project Developer** and **Buyer/Investor**.
> *If Farmer is missing:* the frontend didn't pick up `roles.js` — hard-refresh. *If saving Farmer
> errors:* `admin_set_user_profile` rejected it, which shouldn't happen (that RPC doesn't validate
> roles) — read the console error verbatim.

---

## 1. 🔴 Do this first — the security check nothing else matters without

Migration #17 was supposed to stop a normal user promoting themselves to admin. **Verify it.**

1. Sign in as **FARMER** (any non-admin).
2. Open the browser console and run:

```js
const { data, error } = await window.supabase
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', (await window.supabase.auth.getUser()).data.user.id)
console.log({ data, error })
```

*(If `window.supabase` isn't exposed, do it from the Supabase SQL editor as that user, or skip — but
then run the equivalent from the app's network tab.)*

- ✅ **Expect:** an error, or `data: []` and the role unchanged. Reload — you are still a farmer.
- ❌ **If your role changed to admin:** stop everything. Migration #17 is not really applied.
  Nothing else in this runbook matters. Re-run `20260703000300_harden_profiles_role_kyc.sql`.

---

## 2. Farmer chain — the newest, least-exercised code

This crosses **4 RPCs, 3 RLS policies, and 2 migrations written today**. It is the most likely thing
to break, so do it early.

### 2a. Farmer becomes a farmer
1. **FARMER** → `/apply`, choose **Farmer**, submit.
2. **ADMIN** → the bell should show a *New Farmer application*. Approve it.

- ✅ **Expect:** FARMER's role flips; signing in lands them on `/farmer`.
- ❌ *No notification:* `notify_role_application_trigger()` didn't take migration #25's rewrite.
- ❌ *Approval errors "Invalid target role":* `assign_user_role` still has the old allow-list — re-run #25.
- ❌ *Lands on `/home` not `/farmer`:* `getRoleDefaultRoute` didn't ship; hard-refresh.

### 2b. Parcel + listing
3. **FARMER** → `/farmer` → **Add parcel**. Name it, crop `rice`, **area 5 ha**, **expected yield 100 t/yr**. Save.
4. **FARMER** → `/biomass/sell`.

- ✅ **Expect:** the listing form appears **with no KYB gate** (farmers bypass it, by design).
- ❌ *"Business verification required":* `canList` didn't ship, or the role isn't actually `farmer`.

5. List a product: type **Rice husk**, title anything, unit **tonnes**, price 1500.

- ✅ **Expect:** it appears under *My listings*, and publicly at `/biomass`.
- ❌ *Insert fails:* `biomass_products` RLS — `seller_id = auth.uid()` mismatch.

### 2c. Buyer requests, farmer quotes, buyer accepts
6. **DEV** → `/biomass` → find the listing → **Request quote**, quantity **20 tonnes**.
7. **FARMER** → `/biomass/rfqs` → *Received* tab → **Send quote** at 1500.
8. **DEV** → `/biomass/rfqs` → *My requests* → **Accept quote**.

- ✅ **Expect:** status `accepted`; each party gets a bell notification.
- ❌ *"This request can no longer be quoted":* status guard — the RFQ isn't `open`/`quoted`.

### 2d. Delivery → confirmation → payment
9. **FARMER** → `/farmer` → *Deliveries* tab. The accepted quote appears under **Accepted quotes — ready to deliver**.
10. **Log delivery**: quantity **20**, unit **tonnes**, pick the parcel, attach any PDF/photo as proof.

- ✅ **Expect:** delivery saved, status `pending`. DEV gets a notification.
- ❌ *"Deliveries can only be recorded against an accepted quote":* step 8 didn't take.
- ❌ *Proof upload fails:* the `project-documents` bucket is missing → migrations #19/#20.

11. **DEV** → `/biomass/rfqs` → **Deliveries** tab → **Confirm receipt**.
    **← This is the new modal. It must ask "Which project did this feedstock feed?"**
12. Pick one of DEV's projects. Confirm.

- ✅ **Expect:** status `confirmed`; FARMER notified.
- ❌ *No project dropdown:* migration #31's `project_id` column, or the UI, didn't ship.
- ❌ *"That project does not belong to you":* correct behaviour if you picked someone else's project.

13. **DEV** → same row → **Mark as paid**, reference anything.

- ✅ **Expect:** FARMER's `/farmer` shows **Paid to date ₱30,000**, **Awaiting payment ₱0**.
- ❌ *Farmer can mark their own delivery paid:* RLS hole — `farmer_deliveries` must have **no**
  UPDATE policy. Check migration #25.

### 2e. The two payoffs
14. **FARMER** → `/farmer` → *Parcels* tab.

- ✅ **Expect:** the parcel now shows **Last 12 months: 20 t · 20% of expected** with an amber bar
  (20 of 100 t/yr).
- ❌ *No performance block:* the delivery has no `parcel_id` — you skipped picking a parcel at step 10.

15. **FARMER** → *Carbon* tab.

- ✅ **Expect:** *"No carbon attributed yet"* — **this is correct**, because DEV's project has no
  approved VERs yet. Continue to §3, then come back.

---

## 3. MRV chain — makes the farmer's carbon appear

16. **DEV** → `/monitoring` (Monitoring Report) for the project you named in step 12. Submit a report
    with some activity data.
17. **VERIFIER** → `/verifier` → MRV Report Verification → select it.
    **← The new "Reduction type" dropdown must be there, pre-selected from the project category.**
18. Set **Removal** (or Avoidance), approve, issue credits.

- ✅ **Expect:** credits minted; project listed on the marketplace.
- ❌ *No Reduction type dropdown:* the verifier UI didn't ship.
- ❌ *Approve fails mentioning `reduction_type`:* migration #29 isn't applied — but note the code is
  supposed to **retry without it and still mint**. If it hard-fails, that fallback is broken.

19. **DEV** → `/developer/mrv-dashboard`.

- ✅ **Expect:** *Verified reductions* shows a **removed / avoided** split. A **Farmer supply chain**
  panel shows **1 farmer participating**, **20 t biomass collected**, **5 ha plantation hectares**.
- ❌ *Hectares show "—":* migration #26 isn't applied (the parcel-visibility policy).
- ❌ *No supply panel at all:* no confirmed delivery reached this developer.

20. **FARMER** → `/farmer` → *Carbon* tab **again**.

- ✅ **Expect:** the project, **"You delivered 20 of 20 tonnes (100%)"**, and attributed tCO₂e equal to
  the full verified amount (sole supplier).
- ❌ *Still empty:* `farmer_carbon_participation()` isn't returning. Run it directly in the SQL editor
  as that user; if it errors, migration #31 didn't fully apply.

---

## 4. Investor chain

21. **DEV** → edit the project → fill **CAPEX 200000**, **OPEX 20000**, **lifetime 10**,
    **funding target 500000**, **funding raised 100000**. Also set **Methodology = Gold Standard** and
    **Development status = Operational**. Save.

- ✅ **Expect:** all persist. Reload the edit form — they're still there.
- ❌ *Financials vanish:* the insert whitelist / drift-guard dropped them. This exact class of bug ate
  CAPEX/OPEX before.

22. **DEV** → `/developer/offtakes` → **Add agreement**: counterparty "Japan Energy Capital",
    volume **600**, price **700**, status **Signed**.

- ✅ **Expect:** *Contracted revenue ₱420,000*, *1 signed/active*.
- ❌ *Insert denied:* the doubly-guarded insert policy — you must own the project.

23. **INVESTOR** (Pro) → `/investor`.

- ✅ **Expect:** the project row shows **Contracted %** and, under IRR, a second **contracted** IRR.
  Filters for **standard** and **stage** appear.
- ❌ *Portal empty:* project isn't `validated`.
- ❌ *No contracted column:* `offtake_summary` RPC missing → migration #27.
- ⚠️ **Deliberate:** if contracted revenue ≤ OPEX you'll see **"contracted < opex"** instead of an IRR.
  That is a solvency warning, not a bug.

24. **INVESTOR** → click the **Docs** count → the **data room** opens in-portal → **Open** a document.

- ✅ **Expect:** the PDF opens in a new tab via a signed URL.
- ❌ *Link dead:* storage signed URL failed → bucket private-policy (#20).

25. **DEV** → `/developer/data-room`.

- ✅ **Expect:** **1 interested investor**, the document name, a timestamp.
- ❌ *Empty:* the RPC silently no-oped. Note it **skips self-views** — make sure step 24 was the
  INVESTOR, not DEV.
- 🔒 **Check the privacy promise:** the page must show a **count**, never the investor's name.

---

## 5. Asset ledger

26. **INVESTOR** → buy some credits from the marketplace (sandbox card `4343 4343 4343 4345`).
27. **DEV** → `/developer/ledger`.

- ✅ **Expect:** a **Buyer history** section naming the buyer, credits, value, purchase count.
- ❌ *"Unknown buyer":* `profiles` read was RLS-blocked — the ledger degrades on purpose, but that
  means buyer names will never resolve. Worth fixing if you want real names.

28. Run `select * from reconcile_financials();` in the SQL editor.

- ✅ **Expect: 0 rows.** The money path must still balance after everything above.
- ❌ **Any rows: stop.** Something in this session broke settlement. Nothing above touches the ledger,
  so this would be a genuine surprise.

---

## 6. What "done" looks like

Tick these and the expansion features are runtime-verified:

- [ ] §1 privilege escalation blocked
- [ ] Farmer approved, parcel + listing created, KYB bypassed
- [ ] RFQ → quote → accept
- [ ] Delivery logged with proof, confirmed **with a project**, marked paid
- [ ] Parcel shows actual-vs-expected
- [ ] Verifier set a reduction type; dashboard splits removed/avoided
- [ ] MRV dashboard shows farmers + biomass + hectares
- [ ] Farmer's Carbon tab shows attributed tCO₂e
- [ ] Investor sees contracted % + downside IRR + filters
- [ ] Data room opens; developer sees a **count**, not a name
- [ ] Buyer history names the buyer
- [ ] `reconcile_financials()` = 0 rows

---

## 7. Then, and only then

The remaining work is **not code**:

1. **🔴 Independent penetration test** — the last P0 before live payment keys.
2. **Email confirmation** — currently OFF by choice. Needs a domain (~₱600–900/yr), not a
   subscription: Resend's free tier is 3,000 emails/month. Until then, anyone can sign up with an
   address they don't control.
3. **Training content** (#6e), **AI backend** (#7, API key + running cost), **satellite/IoT**
   (#4, external feeds).
