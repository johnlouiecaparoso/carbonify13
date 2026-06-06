// Debug utility to check user permissions
import { PERMISSIONS } from '@/constants/roles'
import { hasPermission } from '@/services/roleService'

export function debugUserPermissions(userRole) {
  console.log('🔍 DEBUG: User Role Permissions')
  console.log('Current Role:', userRole)

  const testPermissions = [
    'SEARCH_PROJECTS',
    'VIEW_DASHBOARD',
    'MANAGE_WALLET',
    'BUY_CREDITS',
    'VIEW_ADMIN_PANEL',
  ]

  console.log('Permission Check Results:')
  testPermissions.forEach((permission) => {
    const hasAccess = hasPermission(userRole, PERMISSIONS[permission])
    console.log(`  ${permission}: ${hasAccess ? '✅' : '❌'}`)
  })

  console.log('Available Permissions for', userRole, ':')
  Object.keys(PERMISSIONS).forEach((permKey) => {
    if (hasPermission(userRole, PERMISSIONS[permKey])) {
      console.log(`  ✅ ${permKey}`)
    }
  })
}

// Quick test function to call from browser console
window.debugPermissions = debugUserPermissions
