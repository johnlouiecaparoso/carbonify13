/**
 * Test accounts for development and testing ONLY
 * These are automatically disabled in production builds
 */
import { ROLES } from '@/constants/roles'

// Ensure test accounts are only available in development
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

export const TEST_ACCOUNTS = isDevelopment
  ? {
      admin: {
        email: 'admin@carbonify.test',
        password: 'admin123',
        name: 'Admin User',
        role: ROLES.ADMIN,
        mockSession: {
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'admin@carbonify.test',
            user_metadata: { name: 'Admin User' },
          },
          access_token: 'admin-test-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      verifier: {
        email: 'verifier@carbonify.test',
        password: 'verifier123',
        name: 'Verifier User',
        role: ROLES.VERIFIER,
        mockSession: {
          user: {
            id: '22222222-2222-2222-2222-222222222222',
            email: 'verifier@carbonify.test',
            user_metadata: { name: 'Verifier User' },
          },
          access_token: 'verifier-test-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      user: {
        email: 'user@carbonify.test',
        password: 'user123',
        name: 'General User',
        role: ROLES.GENERAL_USER,
        mockSession: {
          user: {
            id: '33333333-3333-3333-3333-333333333333',
            email: 'user@carbonify.test',
            user_metadata: { name: 'General User' },
          },
          access_token: 'user-test-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      projectDeveloper: {
        email: 'developer@carbonify.test',
        password: 'developer123',
        name: 'Project Developer',
        role: ROLES.PROJECT_DEVELOPER,
        mockSession: {
          user: {
            id: '44444444-4444-4444-4444-444444444444',
            email: 'developer@carbonify.test',
            user_metadata: { name: 'Project Developer' },
          },
          access_token: 'developer-test-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    }
  : {} // Empty object in production

// Helper function to get test account by role
export function getTestAccount(role) {
  if (!isDevelopment) return null
  return Object.values(TEST_ACCOUNTS).find((account) => account.role === role)
}

// Helper function to check if email is a test account
export function isTestAccount(email) {
  if (!isDevelopment) return false
  return Object.values(TEST_ACCOUNTS).some((account) => account.email === email)
}

// Helper function to get test account by email
export function getTestAccountByEmail(email) {
  if (!isDevelopment) return null
  return Object.values(TEST_ACCOUNTS).find((account) => account.email === email)
}
