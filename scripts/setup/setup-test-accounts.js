#!/usr/bin/env node

/**
 * Setup Test Accounts in Supabase
 * This script creates all test accounts in your Supabase database
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf8')
    const envVars = {}

    envContent.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim()
      }
    })

    return envVars
  } catch (error) {
    console.warn('⚠️  Could not load .env file, using process.env')
    return process.env
  }
}

const env = loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase environment variables')
  console.error(
    'Please check your .env file and ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set',
  )
  process.exit(1)
}

// Use service role key for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const testAccounts = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@ecolink.test',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    kyc_level: 3,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'verifier@ecolink.test',
    password: 'verifier123',
    name: 'Verifier User',
    role: 'verifier',
    kyc_level: 2,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'user@ecolink.test',
    password: 'user123',
    name: 'General User',
    role: 'general_user',
    kyc_level: 0,
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'developer@ecolink.test',
    password: 'developer123',
    name: 'Project Developer',
    role: 'project_developer',
    kyc_level: 1,
  },
]

async function createTestAccounts() {
  console.log('🚀 Setting up test accounts in Supabase...\n')

  for (const account of testAccounts) {
    try {
      console.log(`Creating ${account.role} account: ${account.email}`)

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        user_id: account.id,
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          name: account.name,
        },
      })

      if (authError) {
        console.log(`⚠️  Auth user might already exist: ${authError.message}`)
      } else {
        console.log(`✅ Auth user created: ${account.email}`)
      }

      // Create profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: account.id,
        full_name: account.name,
        email: account.email,
        role: account.role,
        kyc_level: account.kyc_level,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (profileError) {
        console.log(`⚠️  Profile error: ${profileError.message}`)
      } else {
        console.log(`✅ Profile created: ${account.name}`)
      }

      // Create wallet
      const { error: walletError } = await supabase.from('wallets').upsert({
        user_id: account.id,
        balance: 1000.0,
        currency: 'USD',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (walletError) {
        console.log(`⚠️  Wallet error: ${walletError.message}`)
      } else {
        console.log(`✅ Wallet created: $1000 starting balance`)
      }

      console.log(`✅ ${account.role} account setup complete\n`)
    } catch (error) {
      console.error(`❌ Error creating ${account.role} account:`, error.message)
    }
  }

  console.log('🎉 Test accounts setup completed!')
  console.log('\n📋 Account Summary:')
  console.log('==================')
  testAccounts.forEach((account) => {
    console.log(`${account.role}: ${account.email} / ${account.password}`)
  })

  console.log('\n🚀 You can now login with any of these accounts!')
}

// Run the setup
createTestAccounts().catch(console.error)

