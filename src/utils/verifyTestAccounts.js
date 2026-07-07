// Utility to verify test accounts in Supabase
import { getSupabase } from '@/services/supabaseClient'

export async function verifyTestAccounts() {
  const supabase = getSupabase()

  console.log('🔍 Verifying test accounts in Supabase...')

  try {
    // Get all profiles and check for test accounts by trying to login with each one
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, created_at')
      .order('role')

    if (error) {
      console.error('❌ Error fetching profiles:', error)
      return false
    }

    if (!profiles || profiles.length === 0) {
      console.warn('⚠️ No profiles found in database')
      console.log('📝 Please run the SQL setup script first')
      return false
    }

    // Check for expected roles
    const expectedRoles = ['admin', 'verifier', 'user']
    const testAccountProfiles = profiles.filter((p) => expectedRoles.includes(p.role))

    console.log('✅ Found profiles with test roles:')
    testAccountProfiles.forEach((profile) => {
      const roleEmoji =
        {
          admin: '👑',
          verifier: '✅',
          user: '👤',
        }[profile.role] || '❓'

      console.log(
        `   ${roleEmoji} ${profile.role} - ${profile.full_name} (ID: ${profile.id.substring(0, 8)}...)`,
      )
    })

    if (testAccountProfiles.length >= 3) {
      console.log('🎉 Found test account profiles! Use the login test to verify they work.')
      return true
    } else {
      console.warn(`⚠️ Found ${testAccountProfiles.length}/3 test account profiles`)
      console.log('📝 Please run the SQL setup script to create missing accounts')
      return false
    }
  } catch (error) {
    console.error('❌ Error verifying test accounts:', error)
    return false
  }
}

// Test login functionality for each account
export async function testAccountLogins() {
  const supabase = getSupabase()

  const testAccounts = [
    { email: 'admin@carbonify.test', password: 'admin123', expectedRole: 'admin' },
    { email: 'verifier@carbonify.test', password: 'verifier123', expectedRole: 'verifier' },
    { email: 'user@carbonify.test', password: 'user123', expectedRole: 'user' },
  ]

  console.log('🔐 Testing login functionality for test accounts...')

  for (const account of testAccounts) {
    try {
      console.log(`Testing login for ${account.email}...`)

      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      })

      if (error) {
        console.error(`❌ Login failed for ${account.email}:`, error.message)
        continue
      }

      if (data.user) {
        console.log(`✅ Login successful for ${account.email}`)

        // Get profile to check role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          console.error(`❌ Could not fetch profile for ${account.email}:`, profileError.message)
        } else if (profile.role === account.expectedRole) {
          console.log(`✅ Role verified: ${profile.role} for ${profile.full_name}`)
        } else {
          console.error(`❌ Role mismatch: expected ${account.expectedRole}, got ${profile.role}`)
        }

        // Sign out
        await supabase.auth.signOut()
      }
    } catch (error) {
      console.error(`❌ Error testing ${account.email}:`, error)
    }
  }

  console.log('🏁 Login testing completed')
}

// Quick role check function by user ID
export async function checkUserRole(userId) {
  const supabase = getSupabase()

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single()

    if (error) {
      console.error(`Error checking role for user ${userId}:`, error)
      return null
    }

    return data
  } catch (error) {
    console.error(`Error checking role for user ${userId}:`, error)
    return null
  }
}
