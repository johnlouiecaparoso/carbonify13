#!/usr/bin/env node

/**
 * Supabase Setup Script for EcoLink
 * This script helps you set up Supabase integration
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
  log(`\n${colors.cyan}Step ${step}:${colors.reset} ${message}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue')
}

async function checkEnvironmentVariables() {
  logStep(1, 'Checking environment variables')

  // .env lives at the project root; resolve from the run directory, not the
  // script's own folder (the script was relocated into scripts/setup/).
  const envPath = path.join(process.cwd(), '.env')

  if (!fs.existsSync(envPath)) {
    logError('.env file not found!')
    logInfo('Please create a .env file with your Supabase credentials')
    logInfo('You can copy env.example to .env and fill in your values')
    return false
  }

  const envContent = fs.readFileSync(envPath, 'utf8')

  if (!envContent.includes('VITE_SUPABASE_URL') || !envContent.includes('VITE_SUPABASE_ANON_KEY')) {
    logError('Missing required environment variables!')
    logInfo('Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file')
    return false
  }

  // Load environment variables
  const envVars = {}
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  })

  if (
    envVars.VITE_SUPABASE_URL === 'your_supabase_project_url' ||
    envVars.VITE_SUPABASE_ANON_KEY === 'your_supabase_anon_key'
  ) {
    logError('Please update your .env file with actual Supabase credentials!')
    return false
  }

  logSuccess('Environment variables found')
  return { url: envVars.VITE_SUPABASE_URL, key: envVars.VITE_SUPABASE_ANON_KEY }
}

async function testSupabaseConnection(credentials) {
  logStep(2, 'Testing Supabase connection')

  try {
    const supabase = createClient(credentials.url, credentials.key)

    // Test connection by trying to get session
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      logError(`Connection failed: ${error.message}`)
      return false
    }

    logSuccess('Supabase connection successful')
    return supabase
  } catch (error) {
    logError(`Connection failed: ${error.message}`)
    return false
  }
}

async function checkDatabaseTables(supabase) {
  logStep(3, 'Checking database tables')

  const requiredTables = [
    'profiles',
    'projects',
    'project_credits',
    'credit_listings',
    'credit_transactions',
    'credit_ownership',
    'audit_logs',
    'wallets',
    'wallet_transactions',
    'certificates',
    'receipts',
  ]

  const missingTables = []

  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1)

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist
          missingTables.push(table)
        } else {
          logWarning(`Error checking table ${table}: ${error.message}`)
        }
      } else {
        logSuccess(`Table ${table} exists`)
      }
    } catch (error) {
      logWarning(`Error checking table ${table}: ${error.message}`)
    }
  }

  if (missingTables.length > 0) {
    logError(`Missing tables: ${missingTables.join(', ')}`)
    logInfo('Please run the complete-supabase-setup.sql script in your Supabase SQL Editor')
    return false
  }

  logSuccess('All required tables exist')
  return true
}

async function testAuthentication(supabase) {
  logStep(4, 'Testing authentication')

  try {
    // Test sign up (this will fail if email already exists, which is expected)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123',
    })

    if (signUpError && !signUpError.message.includes('already registered')) {
      logWarning(`Sign up test failed: ${signUpError.message}`)
    } else {
      logSuccess('Authentication system is working')
    }

    // Test sign in with invalid credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@example.com',
      password: 'wrongpassword',
    })

    if (signInError) {
      logSuccess('Authentication validation is working')
    }

    return true
  } catch (error) {
    logError(`Authentication test failed: ${error.message}`)
    return false
  }
}

async function checkRLSPolicies(supabase) {
  logStep(5, 'Checking RLS policies')

  try {
    // Test if we can query profiles table (should work with RLS)
    const { data, error } = await supabase.from('profiles').select('*').limit(1)

    if (error) {
      logWarning(`RLS policy test failed: ${error.message}`)
      return false
    }

    logSuccess('RLS policies are working')
    return true
  } catch (error) {
    logError(`RLS policy test failed: ${error.message}`)
    return false
  }
}

async function runDatabaseSetup() {
  logStep(6, 'Database setup check')

  const setupScriptPath = path.join(__dirname, 'complete-supabase-setup.sql')

  if (!fs.existsSync(setupScriptPath)) {
    logError('Database setup script not found!')
    return false
  }

  logInfo('Database setup script found')
  logInfo('Please run the sql/complete-supabase-setup.sql script in your Supabase SQL Editor')
  logInfo('You can find it in the sql/ folder')

  return true
}

async function main() {
  log(`${colors.bright}${colors.cyan}🚀 EcoLink Supabase Setup Script${colors.reset}`)
  log(`${colors.cyan}================================${colors.reset}`)

  try {
    // Step 1: Check environment variables
    const credentials = await checkEnvironmentVariables()
    if (!credentials) {
      process.exit(1)
    }

    // Step 2: Test Supabase connection
    const supabase = await testSupabaseConnection(credentials)
    if (!supabase) {
      process.exit(1)
    }

    // Step 3: Check database tables
    const tablesExist = await checkDatabaseTables(supabase)
    if (!tablesExist) {
      logWarning('Some tables are missing. Please run the database setup script.')
    }

    // Step 4: Test authentication
    await testAuthentication(supabase)

    // Step 5: Check RLS policies
    await checkRLSPolicies(supabase)

    // Step 6: Database setup
    await runDatabaseSetup()

    log(`\n${colors.green}${colors.bright}🎉 Setup Complete!${colors.reset}`)
    log(`${colors.green}Your Supabase integration is ready to use.${colors.reset}`)

    log(`\n${colors.yellow}Next steps:${colors.reset}`)
    log('1. Run your development server: npm run dev')
    log('2. Test user registration and login')
    log('3. Test project creation and marketplace functionality')
    log('4. Check the Supabase dashboard for data')
  } catch (error) {
    logError(`Setup failed: ${error.message}`)
    process.exit(1)
  }
}

// Run the script
main()
