<template>
  <aside class="app-sidebar">
    <div class="sidebar-brand">
      <div class="brand-badge"><span class="brand-initials">EC</span></div>
      <div class="brand-text">Carbonify</div>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.id"
        type="button"
        class="nav-item"
        :class="{ active: $route.path === item.route }"
        @click="navigateTo(item.route)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar-spacer"></div>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">{{ userInitials }}</div>
        <div class="user-details">
          <div class="user-name">{{ userProfile?.full_name || 'User' }}</div>
          <div class="user-role">{{ userRoleDisplay }}</div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { getProfile } from '@/services/profileService'
import { ROLES, PERMISSIONS, getRoleDisplayName } from '@/constants/roles'

export default {
  name: 'AppSidebar',
  setup() {
    const router = useRouter()
    const store = useUserStore()
    const userProfile = ref(null)

    const allNavItems = [
      // General User items - Dashboard, Wallet, Certificates
      {
        id: 'dashboard',
        label: 'Dashboard',
        route: '/dashboard',
        icon: '🏠',
        permission: PERMISSIONS.VIEW_DASHBOARD,
        roles: [ROLES.GENERAL_USER],
      },
      {
        id: 'wallet',
        label: 'Wallet',
        route: '/wallet',
        icon: '💰',
        permission: PERMISSIONS.MANAGE_WALLET,
        roles: [ROLES.GENERAL_USER],
      },
      {
        id: 'certificates',
        label: 'Certificates',
        route: '/certificates',
        icon: '📜',
        permission: PERMISSIONS.VIEW_CERTIFICATES,
        roles: [ROLES.GENERAL_USER],
      },

      // Project Developer items - Projects, Sales Dashboard
      {
        id: 'projects',
        label: 'Projects',
        route: '/projects',
        icon: '🌱',
        permission: PERMISSIONS.SUBMIT_PROJECTS,
        roles: [ROLES.PROJECT_DEVELOPER],
      },
      {
        id: 'sales',
        label: 'Sales Dashboard',
        route: '/sales',
        icon: '📈',
        permission: PERMISSIONS.SALES_DASHBOARD,
        roles: [ROLES.PROJECT_DEVELOPER],
      },

      // Buyer/Investor items - Marketplace, Buy Credits, Receipts
      {
        id: 'marketplace',
        label: 'Marketplace',
        route: '/marketplace',
        icon: '🏪',
        permission: PERMISSIONS.SEARCH_PROJECTS,
        roles: [ROLES.BUYER_INVESTOR],
      },
      {
        id: 'buy-credits',
        label: 'Buy Credits',
        route: '/buy-credits',
        icon: '💳',
        permission: PERMISSIONS.BUY_CREDITS,
        roles: [ROLES.BUYER_INVESTOR],
      },
      {
        id: 'receipts',
        label: 'Receipts',
        route: '/receipts',
        icon: '🧾',
        permission: PERMISSIONS.DOWNLOAD_RECEIPTS,
        roles: [ROLES.BUYER_INVESTOR],
      },

      // Verifier items - Only Verifier dashboard
      {
        id: 'verifier',
        label: 'Verifier Dashboard',
        route: '/verifier',
        icon: '✅',
        permission: PERMISSIONS.ACCESS_PROJECTS,
        roles: [ROLES.VERIFIER],
      },

      // Admin items - All admin features
      {
        id: 'admin',
        label: 'Admin Dashboard',
        route: '/admin',
        icon: '⚙️',
        permission: PERMISSIONS.VIEW_ADMIN_PANEL,
        roles: [ROLES.ADMIN],
      },
      {
        id: 'users',
        label: 'Users',
        route: '/users',
        icon: '👥',
        permission: PERMISSIONS.MANAGE_USERS,
        roles: [ROLES.ADMIN],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        route: '/analytics',
        icon: '📊',
        permission: PERMISSIONS.VIEW_ANALYTICS,
        roles: [ROLES.ADMIN],
      },
      {
        id: 'database',
        label: 'Database',
        route: '/database',
        icon: '🗄️',
        permission: PERMISSIONS.MANAGE_DATABASE,
        roles: [ROLES.ADMIN],
      },
      {
        id: 'tables',
        label: 'Tables',
        route: '/tables',
        icon: '📋',
        permission: PERMISSIONS.MANAGE_TABLES,
        roles: [ROLES.ADMIN],
      },
    ]

    const navItems = computed(() => {
      return allNavItems.filter((item) => {
        // Check if user has the required permission
        if (item.permission && !store.hasPermission(item.permission)) {
          return false
        }

        // Check if user's role is allowed for this item
        if (item.roles && !item.roles.includes(store.role)) {
          return false
        }

        return true
      })
    })

    const userInitials = computed(() => {
      if (userProfile.value?.full_name) {
        return userProfile.value.full_name
          .split(' ')
          .map((name) => name[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      }
      return 'U'
    })

    const userRoleDisplay = computed(() => {
      const role = userProfile.value?.role || store.role
      return getRoleDisplayName(role)
    })

    async function loadUserProfile() {
      if (store.session?.user?.id) {
        try {
          const profile = await getProfile(store.session.user.id)
          userProfile.value = profile
        } catch (error) {
          console.error('Error loading user profile:', error)
        }
      }
    }

    function navigateTo(route) {
      router.push(route)
    }

    onMounted(() => {
      loadUserProfile()
    })

    return {
      navItems,
      userProfile,
      userInitials,
      userRoleDisplay,
      navigateTo,
    }
  },
}
</script>

<style scoped>
.app-sidebar {
  width: 280px;
  height: 100vh;
  background: var(--eco-gradient);
  color: white;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  box-shadow: var(--shadow-lg);
  border-right: 1px solid var(--eco-tertiary);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 1.25rem;
  border-bottom: 1px solid #2d3748;
}

.brand-badge {
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(10px);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: var(--shadow-sm);
}

.brand-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius);
  position: relative;
  overflow: hidden;
}

.nav-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  transform: translateX(2px);
}

.nav-item:hover::before {
  opacity: 1;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  box-shadow: var(--shadow-sm);
}

.nav-item.active::before {
  opacity: 1;
}

.nav-icon {
  font-size: 1rem;
  width: 1.25rem;
  text-align: center;
}

.nav-label {
  flex: 1;
}

.sidebar-spacer {
  flex: 1;
}

.sidebar-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid #2d3748;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  margin-bottom: 0.75rem;
}

.user-avatar {
  width: 2rem;
  height: 2rem;
  background: #4a5568;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 0.75rem;
  color: #a0aec0;
  text-transform: capitalize;
}

/* Responsive */
@media (max-width: 768px) {
  .app-sidebar {
    width: 100%;
    height: auto;
    position: relative;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .sidebar-nav {
    flex-direction: row;
    flex-wrap: wrap;
    padding: 0.5rem;
  }

  .nav-item {
    flex: 1;
    min-width: 120px;
    justify-content: center;
    padding: 0.5rem;
  }

  .nav-label {
    display: none;
  }

  .sidebar-footer {
    display: none;
  }
}
</style>
