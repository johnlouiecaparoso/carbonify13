import { ROLES } from '@/constants/roles'
import { getRoleDefaultRoute } from '@/utils/getRoleDefaultRoute'

/**
 * Role-based route guard middleware
 * @param {Object} to - Route being navigated to
 * @param {Object} from - Route being navigated from
 * @param {Object} userStore - User store instance
 * @returns {Object|undefined} Navigation guard result
 */
export function createRoleGuard(userStore) {
  return async (to) => {
    // If no session, let the auth guard handle it
    if (!userStore.isAuthenticated) {
      return undefined
    }

    // Ensure profile/role is loaded before making decisions
    if (!userStore.profile) {
      try {
        await userStore.fetchUserProfile()
      } catch { /* profile load failed; continue with current state */ }
    }

    const userRole = userStore.role
    const routePath = to.path

    // Check if user can access the route based on their role
    if (!userStore.canAccessRoute(routePath)) {
      console.warn(`Access denied: User with role '${userRole}' cannot access '${routePath}'`)

      // Redirect to the user's default route (centralized mapping)
      const path = getRoleDefaultRoute(userRole)
      return { path }
    }

    return undefined
  }
}

/**
 * Admin-only route guard
 * @param {Object} userStore - User store instance
 * @returns {Function} Route guard function
 */
export function createAdminGuard(userStore) {
  return async (to) => {
    if (!userStore.isAuthenticated) {
      console.log('[AdminGuard] User not authenticated, redirecting to login')
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    console.log('[AdminGuard] Initial state:', {
      hasProfile: !!userStore.profile,
      currentRole: userStore.role,
      profileRole: userStore.profile?.role,
      isAdmin: userStore.isAdmin,
    })

    // CRITICAL: Always fetch profile to ensure role is up-to-date
    // This handles cases where profile wasn't loaded yet or role changed
    if (!userStore.profile || !userStore.role || userStore.role === ROLES.GENERAL_USER) {
      console.log('[AdminGuard] Profile/role missing, fetching...', {
        hasProfile: !!userStore.profile,
        currentRole: userStore.role,
        profileRole: userStore.profile?.role,
      })
      try {
        await userStore.fetchUserProfile()
        // Give it a moment to update the store
        await new Promise((resolve) => setTimeout(resolve, 300))
        console.log('[AdminGuard] After fetch:', {
          role: userStore.role,
          profileRole: userStore.profile?.role,
          isAdmin: userStore.isAdmin,
          ROLES_ADMIN: ROLES.ADMIN,
          roleMatch: userStore.role === ROLES.ADMIN,
        })
      } catch (error) {
        console.error('❌ Error fetching profile in admin guard:', error)
        // Don't block access if fetch fails - let the route handle it
      }
    }

    // Double-check role after profile fetch - also check profile.role directly
    const roleFromStore = userStore.role
    const roleFromProfile = userStore.profile?.role
    const normalizedRoleFromProfile = roleFromProfile
      ? String(roleFromProfile).toLowerCase().trim()
      : null

    console.log('[AdminGuard] Final check:', {
      roleFromStore: roleFromStore,
      roleFromProfile: roleFromProfile,
      normalizedRoleFromProfile: normalizedRoleFromProfile,
      isAdmin: userStore.isAdmin,
      ROLES_ADMIN: ROLES.ADMIN,
      roleMatch: roleFromStore === ROLES.ADMIN,
      profileRoleMatch: normalizedRoleFromProfile === ROLES.ADMIN,
    })

    // Check both store role and profile role (in case of sync issues)
    const isAdminByStore = userStore.isAdmin
    const isAdminByProfile = normalizedRoleFromProfile === ROLES.ADMIN

    if (!isAdminByStore && !isAdminByProfile) {
      console.warn(
        `❌ Admin access denied: User with role '${roleFromStore}' (profile: '${roleFromProfile}') cannot access admin routes`,
        {
          roleFromStore: roleFromStore,
          roleFromProfile: roleFromProfile,
          normalizedRoleFromProfile: normalizedRoleFromProfile,
          ROLES_ADMIN: ROLES.ADMIN,
          storeMatch: roleFromStore === ROLES.ADMIN,
          profileMatch: normalizedRoleFromProfile === ROLES.ADMIN,
        },
      )
      const path = getRoleDefaultRoute(roleFromStore || ROLES.GENERAL_USER)
      return { path }
    }

    console.log('✅ Admin access granted', {
      roleFromStore: roleFromStore,
      roleFromProfile: roleFromProfile,
      isAdminByStore: isAdminByStore,
      isAdminByProfile: isAdminByProfile,
    })

    return undefined
  }
}

/**
 * Verifier-only route guard
 * @param {Object} userStore - User store instance
 * @returns {Function} Route guard function
 */
export function createVerifierGuard(userStore) {
  return async (to) => {
    if (!userStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    // CRITICAL: Always fetch profile to ensure role is up-to-date
    // This handles cases where profile wasn't loaded yet or role changed
    if (!userStore.profile || !userStore.role || userStore.role === ROLES.GENERAL_USER) {
      console.log('[VerifierGuard] Profile/role missing, fetching...', {
        hasProfile: !!userStore.profile,
        currentRole: userStore.role,
      })
      try {
        await userStore.fetchUserProfile()
        // Give it a moment to update the store
        await new Promise((resolve) => setTimeout(resolve, 200))
        console.log('[VerifierGuard] After fetch:', {
          role: userStore.role,
          isVerifier: userStore.isVerifier,
          ROLES_VERIFIER: ROLES.VERIFIER,
        })
      } catch (error) {
        console.error('Error fetching profile in verifier guard:', error)
        // Don't block access if fetch fails - let the route handle it
      }
    }

    // Double-check role after profile fetch
    console.log('[VerifierGuard] Final check:', {
      role: userStore.role,
      isVerifier: userStore.isVerifier,
      ROLES_VERIFIER: ROLES.VERIFIER,
      roleMatch: userStore.role === ROLES.VERIFIER,
    })

    if (!userStore.isVerifier) {
      console.warn(
        `❌ Verifier access denied: User with role '${userStore.role}' cannot access verifier routes`,
        {
          role: userStore.role,
          ROLES_VERIFIER: ROLES.VERIFIER,
          match: userStore.role === ROLES.VERIFIER,
        },
      )
      const path = getRoleDefaultRoute(userStore.role)
      return { path }
    }

    console.log('✅ Verifier access granted')

    return undefined
  }
}

/**
 * Project Developer-only route guard
 * @param {Object} userStore - User store instance
 * @returns {Function} Route guard function
 */
export function createProjectDeveloperGuard(userStore) {
  return async (to) => {
    if (!userStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    // CRITICAL: Always fetch profile to ensure role is up-to-date
    // This handles cases where profile wasn't loaded yet or role changed
    if (!userStore.profile || !userStore.role || userStore.role === ROLES.GENERAL_USER) {
      console.log('[ProjectDeveloperGuard] Profile/role missing, fetching...', {
        hasProfile: !!userStore.profile,
        currentRole: userStore.role,
      })
      try {
        await userStore.fetchUserProfile()
        // Give it a moment to update the store
        await new Promise((resolve) => setTimeout(resolve, 200))
        console.log('[ProjectDeveloperGuard] After fetch:', {
          role: userStore.role,
          isProjectDeveloper: userStore.isProjectDeveloper,
          ROLES_PROJECT_DEVELOPER: ROLES.PROJECT_DEVELOPER,
        })
      } catch (error) {
        console.error('Error fetching profile in project developer guard:', error)
        // Don't block access if fetch fails - let the route handle it
      }
    }

    // Double-check role after profile fetch
    console.log('[ProjectDeveloperGuard] Final check:', {
      role: userStore.role,
      isProjectDeveloper: userStore.isProjectDeveloper,
      ROLES_PROJECT_DEVELOPER: ROLES.PROJECT_DEVELOPER,
      roleMatch: userStore.role === ROLES.PROJECT_DEVELOPER,
    })

    if (!userStore.isProjectDeveloper) {
      console.warn(
        `❌ Project Developer access denied: User with role '${userStore.role}' cannot access submit project routes`,
        {
          role: userStore.role,
          ROLES_PROJECT_DEVELOPER: ROLES.PROJECT_DEVELOPER,
          match: userStore.role === ROLES.PROJECT_DEVELOPER,
        },
      )
      const path = getRoleDefaultRoute(userStore.role)
      return { path }
    }

    console.log('✅ Project Developer access granted')

    return undefined
  }
}

/**
 * Route guard restricting access to LGU users.
 * @param {Object} userStore - User store instance
 * @returns {Function} Route guard function
 */
export function createLguGuard(userStore) {
  return async (to) => {
    if (!userStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    if (!userStore.profile || !userStore.role || userStore.role === ROLES.GENERAL_USER) {
      try {
        await userStore.fetchUserProfile()
        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (error) {
        console.error('Error fetching profile in LGU guard:', error)
      }
    }

    // Admins may also access LGU tools.
    if (!userStore.isLguUser && !userStore.isAdmin) {
      console.warn(`❌ LGU access denied: role '${userStore.role}' cannot access LGU routes`)
      const path = getRoleDefaultRoute(userStore.role)
      return { path }
    }

    return undefined
  }
}

/**
 * Permission-based route guard
 * @param {string|string[]} requiredPermissions - Required permissions
 * @param {Object} userStore - User store instance
 * @returns {Function} Route guard function
 */
export function createPermissionGuard(requiredPermissions, userStore) {
  return async (to) => {
    if (!userStore.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }

    const permissions = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions]

    if (!userStore.hasAnyPermission(permissions)) {
      console.warn(
        `Permission denied: User with role '${userStore.role}' lacks required permissions:`,
        permissions,
      )
      const path = getRoleDefaultRoute(userStore.role)
      return { path }
    }

    return undefined
  }
}

/**
 * Role-based redirect helper
 * @param {string} userRole - User role
 * @returns {string} Default route for role
 */
export function getDefaultRouteForRole(userRole) {
  // Deprecated: use centralized mapping
  return getRoleDefaultRoute(userRole)
}
