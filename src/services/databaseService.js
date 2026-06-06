import { getSupabase } from './supabaseClient'

export const databaseService = {
  // Execute raw SQL queries (Note: This requires a custom RPC function in Supabase)
  async executeQuery() {
    try {
      // For now, we'll use a simple approach with direct table operations
      // In production, you'd need to create an RPC function in Supabase
      console.warn('executeQuery requires custom RPC function setup in Supabase')
      return { success: false, error: 'SQL execution requires custom RPC function setup' }
    } catch (error) {
      console.error('Database query error:', error)
      return { success: false, error: error.message }
    }
  },

  // Get table information
  async getTableInfo() {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        return { success: false, error: 'Supabase client not available' }
      }

      const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name, table_type')
        .eq('table_schema', 'public')

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching table info:', error)
      return { success: false, error: error.message }
    }
  },

  // Get table schema
  async getTableSchema(tableName) {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        return { success: false, error: 'Supabase client not available' }
      }

      const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching table schema:', error)
      return { success: false, error: error.message }
    }
  },

  // Get table data
  async getTableData(tableName, limit = 100) {
    try {
      const supabase = getSupabase()
      if (!supabase) {
        return { success: false, error: 'Supabase client not available' }
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(limit)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { success: true, data }
    } catch (error) {
      console.error('Error fetching table data:', error)
      return { success: false, error: error.message }
    }
  },

  // Drop table (Note: This requires manual execution in Supabase SQL Editor)
  async dropTable(tableName) {
    try {
      console.warn(`To drop table "${tableName}", run this SQL in Supabase SQL Editor:`)
      console.log(`DROP TABLE IF EXISTS public.${tableName} CASCADE;`)
      return {
        success: false,
        error: `Please run "DROP TABLE IF EXISTS public.${tableName} CASCADE;" in Supabase SQL Editor`,
      }
    } catch (error) {
      console.error('Error dropping table:', error)
      return { success: false, error: error.message }
    }
  },

  // Create table from predefined schemas (Note: This requires manual execution in Supabase SQL Editor)
  async createTable(tableName, schema) {
    try {
      console.warn(`To create table "${tableName}", run this SQL in Supabase SQL Editor:`)
      console.log(schema)
      return {
        success: false,
        error: `Please run the provided SQL in Supabase SQL Editor to create "${tableName}"`,
      }
    } catch (error) {
      console.error('Error creating table:', error)
      return { success: false, error: error.message }
    }
  },
}

// Predefined table schemas
export const tableSchemas = {
  wallet_accounts: `
    CREATE TABLE public.wallet_accounts (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      current_balance numeric(12,2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'PHP',
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT wallet_accounts_pkey PRIMARY KEY (id),
      CONSTRAINT wallet_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE,
      CONSTRAINT wallet_accounts_user_id_unique UNIQUE (user_id)
    );
  `,

  wallet_transactions: `
    CREATE TABLE public.wallet_transactions (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      account_id uuid NULL,
      type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund')),
      amount numeric(12,2) NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
      payment_method text,
      description text,
      reference_id text,
      external_reference text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id),
      CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE,
      CONSTRAINT wallet_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES wallet_accounts (id)
    );
  `,

  verifications: `
    CREATE TABLE public.verifications (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL,
      verifier_id uuid NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
      comments text,
      verification_notes text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      verified_at timestamp with time zone,
      CONSTRAINT verifications_pkey PRIMARY KEY (id),
      CONSTRAINT verifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      CONSTRAINT verifications_verifier_id_fkey FOREIGN KEY (verifier_id) REFERENCES profiles (id) ON DELETE CASCADE,
      CONSTRAINT verifications_project_verifier_unique UNIQUE (project_id, verifier_id)
    );
  `,

  listings: `
    CREATE TABLE public.listings (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      price numeric(12,2) NOT NULL,
      currency text NOT NULL DEFAULT 'PHP',
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
      description text,
      available_credits numeric(12,2) NOT NULL,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      expires_at timestamp with time zone,
      CONSTRAINT listings_pkey PRIMARY KEY (id),
      CONSTRAINT listings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      CONSTRAINT listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles (id) ON DELETE CASCADE
    );
  `,

  orders: `
    CREATE TABLE public.orders (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      listing_id uuid NOT NULL,
      buyer_id uuid NOT NULL,
      seller_id uuid NOT NULL,
      amount numeric(12,2) NOT NULL,
      currency text NOT NULL DEFAULT 'PHP',
      credits_purchased numeric(12,2) NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'completed', 'cancelled', 'refunded')),
      payment_method text,
      transaction_id uuid,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now(),
      completed_at timestamp with time zone,
      CONSTRAINT orders_pkey PRIMARY KEY (id),
      CONSTRAINT orders_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE,
      CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES profiles (id) ON DELETE CASCADE,
      CONSTRAINT orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES profiles (id) ON DELETE CASCADE,
      CONSTRAINT orders_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES wallet_transactions (id)
    );
  `,

  audit_logs: `
    CREATE TABLE public.audit_logs (
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      user_id uuid,
      action text NOT NULL,
      table_name text,
      record_id uuid,
      old_values jsonb,
      new_values jsonb,
      ip_address inet,
      user_agent text,
      created_at timestamp with time zone DEFAULT now(),
      CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
      CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE SET NULL
    );
  `,
}
