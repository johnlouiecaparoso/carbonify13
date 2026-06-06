#!/usr/bin/env node

/**
 * Simple Supabase Integration Test
 * This script tests basic Supabase functionality without external dependencies
 */

import { createClient } from '@supabase/supabase-js'

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment')
  console.error('You can set them in your .env file or export them in your terminal')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testBasicConnection() {
  console.log('🔍 Testing basic Supabase connection...')

  try {
    const { error } = await supabase.from('profiles').select('count').limit(1)

    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }

    console.log('✅ Supabase connection successful')
    return true
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
    return false
  }
}

async function testTables() {
  console.log('🔍 Testing required tables...')

  const tables = ['profiles', 'projects', 'project_credits', 'credit_listings']
  let allTablesExist = true

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1)

      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`)
        allTablesExist = false
      } else {
        console.log(`✅ Table ${table}: accessible`)
      }
    } catch (error) {
      console.log(`❌ Table ${table}: ${error.message}`)
      allTablesExist = false
    }
  }

  return allTablesExist
}

async function testAuthentication() {
  console.log('🔍 Testing authentication...')

  try {
    // Test if we can access auth
    const { error } = await supabase.auth.getSession()

    if (error) {
      console.log('⚠️  Auth test failed:', error.message)
      return false
    }

    console.log('✅ Authentication service accessible')
    return true
  } catch (error) {
    console.log('❌ Auth test failed:', error.message)
    return false
  }
}

async function runSimpleTest() {
  console.log('🚀 Starting Simple Supabase Integration Test\n')

  const results = {
    connection: false,
    tables: false,
    auth: false,
  }

  // Test 1: Basic Connection
  results.connection = await testBasicConnection()
  console.log('')

  // Test 2: Tables
  results.tables = await testTables()
  console.log('')

  // Test 3: Authentication
  results.auth = await testAuthentication()
  console.log('')

  // Summary
  console.log('📊 Test Results:')
  console.log('================')
  console.log(`Connection: ${results.connection ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Tables: ${results.tables ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Auth: ${results.auth ? '✅ PASS' : '❌ FAIL'}`)

  const allPassed = Object.values(results).every((result) => result)

  if (allPassed) {
    console.log('\n🎉 All basic tests passed! Your Supabase integration is working.')
    console.log('\nNext steps:')
    console.log('1. Test your application: npm run dev')
    console.log('2. Try registering a user')
    console.log('3. Create a project')
    console.log('4. Browse the marketplace')
  } else {
    console.log('\n⚠️  Some tests failed. Please check your Supabase configuration.')
    console.log('\nTroubleshooting:')
    console.log('1. Verify your .env file has correct VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
    console.log('2. Check your Supabase project is active')
    console.log('3. Ensure all tables exist in your database')
  }

  return allPassed
}

// Run the test
runSimpleTest().catch(console.error)

