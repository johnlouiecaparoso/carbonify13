-- ============================================================================
-- Drift fix: wallet_transactions.external_reference
--
-- wallet_transactions was created outside version control (see the schema-drift
-- notes) and the live table is missing `external_reference`. The paymongo-webhook
-- writes the top-up audit row with external_reference = <checkout session id>,
-- and the callback (webhookService.checkWebhookTransactionStatus) polls that
-- column to confirm the top-up. With the column absent:
--   * the webhook's audit-row insert fails (caught as non-critical) → no row, and
--   * the callback's filter `external_reference=eq.cs_...` returns HTTP 400,
-- so the top-up (flow B) shows "not yet credited" even though the balance WAS
-- credited by update_wallet_balance_atomic.
--
-- Idempotent: adds the column only if missing, plus a lookup index. No data
-- change. Reloads the PostgREST schema cache so the new column is queryable
-- immediately.
-- ============================================================================

alter table public.wallet_transactions
  add column if not exists external_reference text;

create index if not exists idx_wallet_transactions_external_reference
  on public.wallet_transactions (external_reference);

notify pgrst, 'reload schema';
