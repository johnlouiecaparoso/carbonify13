import { getSupabase } from '@/services/supabaseClient'
import { ROLES } from '@/constants/roles'
import { logUserAction } from '@/services/auditService'

/**
 * Role service for managing user roles and permissions
 */
export class RoleService {
  constructor() {
    // Silently get Supabase - errors are already logged in supabaseClient
    try {
      this.supabase = getSupabase()
    } catch {
      // Supabase not available - service will work in limited mode
      this.supabase = null
    }
  }

  /**
   * Check if user is admin
   */
  isAdmin(role) {
    return role === ROLES.ADMIN
  }

  /**
   * Check if user is general user
   */
  isGeneralUser(role) {
    return role === ROLES.GENERAL_USER
  }

  /**
   * Check if user is project developer
   */
  isProjectDeveloper(role) {
    return role === ROLES.PROJECT_DEVELOPER
  }

  /**
   * Check if user is verifier
   */
  isVerifier(role) {
    return role === ROLES.VERIFIER
  }

  /**
   * Check if user is buyer/investor
   */
  isBuyerInvestor(role) {
    return role === ROLES.BUYER_INVESTOR
  }

  /**
   * Check if user is LGU (local government unit)
   */
  isLguUser(role) {
    return role === ROLES.LGU_USER
  }

  /**
   * Check if user is a farmer (smallholder feedstock supplier)
   */
  isFarmer(role) {
    return role === ROLES.FARMER
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(role, permission) {
    const rolePermissions = this.getRolePermissions(role)
    return rolePermissions.includes(permission)
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(role, permissions) {
    return permissions.some((permission) => this.hasPermission(role, permission))
  }

  /**
   * Check if user has all specified permissions
   */
  hasAllPermissions(role, permissions) {
    return permissions.every((permission) => this.hasPermission(role, permission))
  }

  /**
   * Check if user can access a specific route
   */
  canAccessRoute(role, routePath) {
    const routePermissions = this.getRoutePermissions(routePath)
    return this.hasAnyPermission(role, routePermissions)
  }

  /**
   * Get permissions for a role
   */
  getRolePermissions(role) {
    const permissions = {
      [ROLES.ADMIN]: [
        'view_all_projects',
        'edit_all_projects',
        'delete_all_projects',
        'approve_projects',
        'reject_projects',
        'view_all_users',
        'edit_user_roles',
        'view_audit_logs',
        'manage_system_settings',
        'view_analytics',
        'manage_marketplace',
        'view_all_transactions',
      ],
      [ROLES.VERIFIER]: [
        'view_all_projects',
        'edit_project_status',
        'approve_projects',
        'reject_projects',
        'view_project_details',
        'add_verification_notes',
        'view_verification_history',
        'view_own_profile',
        'edit_own_profile',
        'view_own_transactions',
      ],
      [ROLES.PROJECT_DEVELOPER]: [
        'create_projects',
        'edit_own_projects',
        'delete_own_projects',
        'view_own_projects',
        'submit_projects',
        'view_project_status',
        'create_credit_listings',
        'manage_own_listings',
      ],
      [ROLES.LGU_USER]: [
        'upload_lgu_emissions',
        'view_community_projects',
        'view_own_profile',
        'edit_own_profile',
      ],
      [ROLES.BUYER_INVESTOR]: [
        'view_marketplace',
        'purchase_credits',
        'view_own_portfolio',
        'retire_credits',
        'view_certificates',
        'view_receipts',
        'manage_wallet',
      ],
      [ROLES.FARMER]: [
        'manage_farm_parcels',
        'record_deliveries',
        'sell_feedstock',
        'view_marketplace',
        'view_own_profile',
        'edit_own_profile',
        'view_own_transactions',
        'manage_wallet',
      ],
      [ROLES.GENERAL_USER]: [
        'view_marketplace',
        'view_own_profile',
        'edit_own_profile',
        'view_own_transactions',
      ],
    }

    return permissions[role] || []
  }

  /**
   * Get required permissions for a route
   */
  getRoutePermissions(routePath) {
    const routePermissions = {
      '/admin': ['view_all_projects', 'manage_system_settings'],
      '/admin/projects': ['view_all_projects'],
      '/admin/users': ['view_all_users', 'edit_user_roles'],
      '/admin/analytics': ['view_analytics'],
      '/admin/audit': ['view_audit_logs'],
      '/verifier': ['view_all_projects', 'edit_project_status'],
      '/farmer': ['manage_farm_parcels'],
      '/projects': ['create_projects', 'view_own_projects'],
      '/marketplace': ['view_marketplace'],
      '/portfolio': ['view_own_portfolio'],
      '/wallet': ['manage_wallet'],
      '/certificates': ['view_certificates'],
      '/receipts': ['view_receipts'],
      '/profile': ['view_own_profile'], // Profile is accessible to all authenticated users
    }

    // Find matching route (supports dynamic routes)
    for (const [route, permissions] of Object.entries(routePermissions)) {
      if (routePath.startsWith(route)) {
        return permissions
      }
    }

    // Default permissions for unknown routes - allow if user is authenticated
    // This prevents blocking access to routes that might not be in the list
    return ['view_own_profile']
  }

  /**
   * Update user role
   */
  async updateUserRole(userId, newRole, options = {}) {
    const supabase = getSupabase()

    if (!supabase) {
      throw new Error('Supabase client not available')
    }

    try {
      // Validate role
      if (!Object.values(ROLES).includes(newRole)) {
        throw new Error('Invalid role')
      }

      const { data: rpcProfile, error: rpcError } = await supabase.rpc('assign_user_role', {
        target_user_id: userId,
        target_role: newRole,
        target_email: options.email || null,
        target_full_name: options.fullName || null,
      })

      if (rpcError) {
        console.error('Error assigning user role through RPC:', rpcError)
        throw new Error(
          rpcError.message?.includes('function public.assign_user_role')
            ? 'Role assignment RPC is not available yet. Please run the latest Supabase migration before approving applications.'
            : rpcError.message || 'Failed to assign user role',
        )
      }

      try {
        await logUserAction('ROLE_CHANGE_APPLIED', 'user', userId, userId, {
          new_role: newRole,
        })
      } catch (logErr) {
        console.warn('Could not log role change (non-critical):', logErr)
      }

      return rpcProfile || { id: userId, role: newRole }
    } catch (error) {
      console.error('Error in updateUserRole:', error)
      throw error
    }
  }

  /**
   * Get user role
   */
  async getUserRole(userId) {
    const supabase = getSupabase()

    if (!supabase) {
      return ROLES.GENERAL_USER
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error || !profile) {
        return ROLES.GENERAL_USER
      }

      return profile.role || ROLES.GENERAL_USER
    } catch (error) {
      console.error('Error getting user role:', error)
      return ROLES.GENERAL_USER
    }
  }

  /**
   * Get all available roles
   */
  getAllRoles() {
    return Object.values(ROLES)
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(role) {
    const displayNames = {
      [ROLES.ADMIN]: 'Administrator',
      [ROLES.VERIFIER]: 'Verifier',
      [ROLES.PROJECT_DEVELOPER]: 'Project Developer',
      [ROLES.LGU_USER]: 'LGU User',
      [ROLES.BUYER_INVESTOR]: 'Buyer/Investor',
      [ROLES.FARMER]: 'Farmer',
      [ROLES.GENERAL_USER]: 'General User',
    }

    return displayNames[role] || 'Unknown Role'
  }

  /**
   * Get role description
   */
  getRoleDescription(role) {
    const descriptions = {
      [ROLES.ADMIN]: 'Full system access with ability to manage all aspects of the platform',
      [ROLES.VERIFIER]: 'Can review and approve/reject carbon credit projects',
      [ROLES.PROJECT_DEVELOPER]: 'Can create and manage carbon credit projects',
      [ROLES.BUYER_INVESTOR]: 'Can purchase and manage carbon credits',
      [ROLES.GENERAL_USER]: 'Basic user access to view marketplace and manage profile',
      [ROLES.LGU_USER]: 'Local Government Unit user: upload LGU emissions and manage community projects',
      [ROLES.FARMER]:
        'Smallholder feedstock supplier: register plantation parcels, list biomass, and log deliveries against accepted quotes',
    }

    return descriptions[role] || 'No description available'
  }
}

// Export singleton instance
export const roleService = new RoleService()

// Export individual functions for convenience (bound to service instance)
export const isAdmin = roleService.isAdmin.bind(roleService)
export const isVerifier = roleService.isVerifier.bind(roleService)
export const isProjectDeveloper = roleService.isProjectDeveloper.bind(roleService)
export const isBuyerInvestor = roleService.isBuyerInvestor.bind(roleService)
export const isGeneralUser = roleService.isGeneralUser.bind(roleService)
export const isLguUser = roleService.isLguUser.bind(roleService)
export const isFarmer = roleService.isFarmer.bind(roleService)
export const hasPermission = roleService.hasPermission.bind(roleService)
export const hasAnyPermission = roleService.hasAnyPermission.bind(roleService)
export const hasAllPermissions = roleService.hasAllPermissions.bind(roleService)
export const getRolePermissions = roleService.getRolePermissions.bind(roleService)
export const canAccessRoute = roleService.canAccessRoute.bind(roleService)
export const updateUserRole = roleService.updateUserRole.bind(roleService)
export const getUserRole = roleService.getUserRole.bind(roleService)
export const getAllRoles = roleService.getAllRoles.bind(roleService)
export const getRoleDescription = roleService.getRoleDescription.bind(roleService)
export const getRoleDisplayName = roleService.getRoleDisplayName.bind(roleService)
