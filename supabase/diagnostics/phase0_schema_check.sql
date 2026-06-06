-- Phase 0 schema diagnostic (READ-ONLY).
--
-- The base tables credit_transactions, wallet_accounts, and certificates are
-- NOT created by any tracked migration, so we cannot author correct fixes for
-- the remaining console 400s without seeing the live schema. Run this in the
-- Supabase SQL Editor and share the output; the FK + wallet_accounts fixes can
-- then be written against reality instead of guessed.
--
-- Nothing here mutates data. Safe to run on production.

-- 1) Columns on the three tables (confirms real names, e.g. user_id vs owner_id,
--    and whether certificate_type / certificate_data already exist live).
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('credit_transactions', 'wallet_accounts', 'certificates')
order by table_name, ordinal_position;

-- 2) Foreign keys on credit_transactions (drives console errors #2 and #4 —
--    the receipt/certificate join from credit_transactions -> profiles).
select
  tc.constraint_name,
  kcu.column_name        as fk_column,
  ccu.table_name         as references_table,
  ccu.column_name        as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name = 'credit_transactions';

-- 3) RLS status + policies on these tables (drives console error #5 —
--    wallet_accounts 400 may be an RLS denial rather than a column-name issue).
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('credit_transactions', 'wallet_accounts', 'certificates');

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('credit_transactions', 'wallet_accounts', 'certificates')
order by tablename, policyname;

-- 4) Which of the pending Phase 0 migrations are already applied live?
--    (If your project tracks them in supabase_migrations.schema_migrations.)
select version, name
from supabase_migrations.schema_migrations
where version >= '20260215000000'
order by version;
