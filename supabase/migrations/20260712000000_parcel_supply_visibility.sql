-- ============================================================================
-- Parcel supply visibility — unblocks "plantation hectares" on the MRV dashboard.
--
-- Migration #25 made `farm_parcels` private to the owning farmer. That is right
-- for the register itself, but it also means a developer who has RECEIVED and
-- CONFIRMED a delivery from a parcel cannot see that parcel's area — so the MRV
-- dashboard could not report plantation hectares (expansion #4's spec bullet).
--
-- This adds a narrow second SELECT policy: a buyer may read a parcel ONLY if that
-- parcel supplied them a delivery they themselves confirmed. It is provenance
-- data about their own supply chain, not a window into the farmer's whole farm:
--
--   • scoped to `status = 'confirmed'` — a pending/rejected delivery grants nothing,
--     so a farmer cannot be exposed by merely logging a delivery against a buyer;
--   • scoped to `buyer_id = auth.uid()` — only the receiving buyer, not all buyers;
--   • the owner policy from #25 is untouched and still governs INSERT/UPDATE/DELETE.
--
-- Additive + idempotent + drift-safe. Safe to re-run.
-- ============================================================================

do $$
begin
  if to_regclass('public.farm_parcels') is null
     or to_regclass('public.farmer_deliveries') is null then
    return; -- migration #25 not applied yet; nothing to do
  end if;

  drop policy if exists "farm_parcels supplied buyer select" on public.farm_parcels;
  create policy "farm_parcels supplied buyer select"
    on public.farm_parcels for select
    using (
      exists (
        select 1
          from public.farmer_deliveries d
         where d.parcel_id = public.farm_parcels.id
           and d.buyer_id  = auth.uid()
           and d.status    = 'confirmed'
      )
    );
end $$;

-- The dashboard filters deliveries by (buyer_id, status); the policy above probes
-- by (parcel_id, buyer_id, status). Index both shapes.
create index if not exists idx_farmer_deliveries_parcel_buyer
  on public.farmer_deliveries (parcel_id, buyer_id, status);

notify pgrst, 'reload schema';
