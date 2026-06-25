// Simplified auth service for testing
export async function loginWithEmail({ email, password }) {
  // Mock login for testing
  if (email === 'demo@carbonify.io' && password === 'demo123') {
    return {
      user: {
        id: 'demo-user-id',
        email: 'demo@carbonify.io',
        name: 'Demo User'
      },
      session: {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token'
      }
    }
  }
  
  throw new Error('Invalid credentials')
}

export async function registerWithEmail({ name, email, password }) {
  // Mock registration for testing
  console.log('Mock registration called with:', { name, email, password })
  
  // Simulate a small delay
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Simulate successful registration
  const result = {
    user: {
      id: 'new-user-id',
      email: email,
      name: name
    },
    session: null // No session for new registrations
  }
  
  console.log('Mock registration successful:', result)
  return result
}

export async function logout() {
  // Mock logout
  console.log('Mock logout')
  return { error: null }
}
