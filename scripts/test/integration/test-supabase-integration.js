#!/usr/bin/env node

/**
 * Test script for Supabase integration
 * Run this to verify your Supabase setup is working
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '.env')

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!')
    console.log('Please create a .env file with your Supabase credentials')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const envVars = {}

  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=')
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim()
    }
  })

  return envVars
}

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...')

  const envVars = loadEnv()
  const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY)

  try {
    // Test basic connection
    const { error } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }

    console.log('✅ Supabase connection successful')
    return supabase
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    return false
  }
}

async function testDatabaseTables(supabase) {
  console.log('🔍 Testing database tables...')

  const tables = [
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

  let allTablesExist = true

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1)

      if (error) {
        if (error.code === '42P01') {
          console.error(`❌ Table ${table} does not exist`)
          allTablesExist = false
        } else {
          console.log(`⚠️  Table ${table} exists but has issues: ${error.message}`)
        }
      } else {
        console.log(`✅ Table ${table} exists`)
      }
    } catch (error) {
      console.error(`❌ Error checking table ${table}:`, error.message)
      allTablesExist = false
    }
  }

  return allTablesExist
}

async function testAuthentication(supabase) {
  console.log('🔍 Testing authentication...')

  try {
    // Test sign up with a unique email
    const testEmail = `test-${Date.now()}@example.com`
    const { error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'testpassword123',
    })

    if (signUpError) {
      console.error('❌ Sign up test failed:', signUpError.message)
      return false
    }

    console.log('✅ Sign up test successful')

    // Test sign in
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'testpassword123',
    })

    if (signInError) {
      console.error('❌ Sign in test failed:', signInError.message)
      return false
    }

    console.log('✅ Sign in test successful')

    // Test profile creation
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: signInData.user.id,
        full_name: 'Test User',
        email: testEmail,
        role: 'general_user',
      })
      .select()
      .single()

    if (profileError) {
      console.error('❌ Profile creation test failed:', profileError.message)
      return false
    }

    console.log('✅ Profile creation test successful')

    // Clean up test user
    await supabase.auth.signOut()

    return true
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message)
    return false
  }
}

async function testProjectCreation(supabase) {
  console.log('🔍 Testing project creation...')

  try {
    // Create a test project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        title: 'Test Project',
        description: 'This is a test project',
        category: 'Renewable Energy',
        location: 'Test Location',
        expected_impact: 'Test impact',
        user_id: '33333333-3333-3333-3333-333333333333', // Test user ID
        status: 'pending',
      })
      .select()
      .single()

    if (projectError) {
      console.error('❌ Project creation test failed:', projectError.message)
      return false
    }

    console.log('✅ Project creation test successful')

    // Clean up test project
    await supabase.from('projects').delete().eq('id', projectData.id)

    return true
  } catch (error) {
    console.error('❌ Project creation test failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 EcoLink Supabase Integration Test')
  console.log('=====================================\n')

  try {
    // Test 1: Connection
    const supabase = await testSupabaseConnection()
    if (!supabase) {
      process.exit(1)
    }

    // Test 2: Database tables
    const tablesExist = await testDatabaseTables(supabase)
    if (!tablesExist) {
      console.log('\n⚠️  Some tables are missing. Please run the database setup script.')
    }

    // Test 3: Authentication
    const authWorking = await testAuthentication(supabase)
    if (!authWorking) {
      console.log('\n⚠️  Authentication tests failed.')
    }

    // Test 4: Project creation
    const projectWorking = await testProjectCreation(supabase)
    if (!projectWorking) {
      console.log('\n⚠️  Project creation tests failed.')
    }

    console.log('\n🎉 Integration test completed!')
    console.log('\nNext steps:')
    console.log('1. Start your development server: npm run dev')
    console.log('2. Open http://localhost:5173 in your browser')
    console.log('3. Test user registration and login')
    console.log('4. Test project creation and marketplace functionality')
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run the test
main()

