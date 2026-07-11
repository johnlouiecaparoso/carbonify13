-- ============================================================================
-- L7 fix (hardening): revoke the default PUBLIC EXECUTE from the biomass RPCs.
--
-- submit_biomass_quote / respond_biomass_quote / close_biomass_rfq were granted
-- to `authenticated` without first revoking the Postgres default PUBLIC grant, so
-- `anon` retained EXECUTE. Not exploitable today — each self-gates on auth.uid()
-- and raises before any write for an anonymous caller — but it is inconsistent
-- with the farmer / offtake / data-room RPCs, which all revoke first. Bringing
-- them in line removes a latent foot-gun (one future edit that drops the
-- auth.uid() guard would otherwise become a hole).
-- ============================================================================

revoke all on function public.submit_biomass_quote(uuid, numeric, text) from public, anon;
revoke all on function public.respond_biomass_quote(uuid, boolean) from public, anon;
revoke all on function public.close_biomass_rfq(uuid) from public, anon;

grant execute on function public.submit_biomass_quote(uuid, numeric, text) to authenticated;
grant execute on function public.respond_biomass_quote(uuid, boolean) to authenticated;
grant execute on function public.close_biomass_rfq(uuid) to authenticated;

notify pgrst, 'reload schema';
