-- Event-level idempotency + audit log for inbound payment webhooks (Phase 1.3).
--
-- The paymongo-webhook function records every event here keyed by
-- (provider, event_id). A unique violation on insert means the event was
-- already received; the function only short-circuits when the prior attempt
-- reached status 'processed', so retries of unfinished events are reprocessed.
--
-- This table is written exclusively by the Edge Function via the service role,
-- which bypasses RLS. We enable RLS with NO policies so it is deny-all to
-- anon/authenticated clients (financial/audit data must never be client-readable).

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paymongo',
  event_id text not null,
  event_type text,
  payload jsonb,
  status text not null default 'received', -- received | processed
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint webhook_events_provider_event_unique unique (provider, event_id)
);

-- Fast lookup of recent unprocessed events (reconciliation in Phase 1.6).
create index if not exists idx_webhook_events_status_received_at
  on public.webhook_events (status, received_at desc);

alter table public.webhook_events enable row level security;
-- Intentionally no policies: deny-all to anon/authenticated; service role bypasses RLS.

notify pgrst, 'reload schema';
