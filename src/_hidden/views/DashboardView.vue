<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { getProfile } from '@/services/profileService'
// import ComprehensiveDashboard from '@/components/dashboard/ComprehensiveDashboard.vue'

const router = useRouter()
const store = useUserStore()

const user = ref({ name: 'Carbonify User', email: 'user@carbonify.io' })

// Back navigation functionality
const showBackButton = ref(false)
const previousRoute = ref(null)

// Mobile menu functionality
const mobileMenuOpen = ref(false)

// User profile dropdown functionality
const userDropdownOpen = ref(false)

// Navigation items based on user role
const navItems = computed(() => {
  const baseItems = [{ id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: '📊' }]

  // Add role-specific items
  if (store.role === 'user') {
    baseItems.push(
      { id: 'wallet', label: 'Wallet', route: '/wallet', icon: '💰' },
      { id: 'certificates', label: 'Certificates', route: '/certificates', icon: '📜' },
    )
  } else if (store.role === 'project_developer') {
    baseItems.push(
      { id: 'projects', label: 'Projects', route: '/projects', icon: '🌱' },
      { id: 'sales', label: 'Sales Dashboard', route: '/sales', icon: '📈' },
    )
  } else if (store.role === 'buyer_investor') {
    baseItems.push(
      { id: 'marketplace', label: 'Marketplace', route: '/marketplace', icon: '🏪' },
      { id: 'buy-credits', label: 'Buy Credits', route: '/buy-credits', icon: '💳' },
      { id: 'receipts', label: 'Receipts', route: '/receipts', icon: '🧾' },
    )
  } else if (store.role === 'verifier') {
    baseItems.push({ id: 'verifier', label: 'Verifier Dashboard', route: '/verifier', icon: '✅' })
  } else if (store.role === 'admin') {
    baseItems.push(
      { id: 'admin', label: 'Admin Dashboard', route: '/admin', icon: '⚙️' },
      { id: 'users', label: 'Users', route: '/users', icon: '👥' },
      { id: 'analytics', label: 'Analytics', route: '/analytics', icon: '📊' },
      { id: 'database', label: 'Database', route: '/database', icon: '🗄️' },
      { id: 'tables', label: 'Tables', route: '/tables', icon: '📋' },
      { id: 'audit-logs', label: 'Audit Logs', route: '/audit-logs', icon: '📝' },
    )
  }

  return baseItems
})

// User initials for avatar
const userInitials = computed(() => {
  if (user.value.name) {
    return user.value.name
      .split(' ')
      .map((name) => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return 'U'
})

const userProfile = ref(null)

// Removed unused metrics - using overviewMetrics instead

async function loadUserProfile() {
  if (!store.session?.user?.id) return

  try {
    userProfile.value = await getProfile(store.session.user.id)
    if (userProfile.value) {
      user.value.name = userProfile.value.full_name || 'Carbonify User'
      user.value.email = store.session.user.email || 'user@carbonify.io'
    }
  } catch (error) {
    console.error('Error loading profile:', error)
  }
}

// Removed unused utility functions

function navigateTo(route) {
  // Store current route as previous for back navigation
  previousRoute.value = router.currentRoute.value.path
  router.push(route)
}

function goBack() {
  if (previousRoute.value) {
    router.push(previousRoute.value)
  } else {
    router.push('/dashboard')
  }
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function toggleUserDropdown() {
  userDropdownOpen.value = !userDropdownOpen.value
}

function closeUserDropdown() {
  userDropdownOpen.value = false
}

async function onSignOut() {
  try {
    await store.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
  }
}

function navigateToProfile() {
  navigateTo('/profile')
  closeUserDropdown()
}

function navigateToWallet() {
  navigateTo('/wallet')
  closeUserDropdown()
}

function navigateToCertificates() {
  navigateTo('/certificates')
  closeUserDropdown()
}

function navigateToSettings() {
  navigateTo('/settings')
  closeUserDropdown()
}

function handleLogout() {
  onSignOut()
  closeUserDropdown()
}

onMounted(async () => {
  await loadUserProfile()

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.header-right')) {
      closeUserDropdown()
    }
  })
})
</script>

<template>
  <div class="home-layout">
    <!-- Left Sidebar -->
    <aside class="sidebar" :class="{ open: mobileMenuOpen }">
      <div class="sidebar-brand">
        <div class="brand-logo">
          <div class="logo-circles">
            <div class="circle circle-1"></div>
            <div class="circle circle-2"></div>
          </div>
        </div>
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
    </aside>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Top Header -->
      <header class="top-header">
        <div class="header-left">
          <button class="mobile-menu-btn" @click="toggleMobileMenu">
            <span class="menu-icon">☰</span>
          </button>
          <button v-if="showBackButton" class="back-button" @click="goBack">
            <span class="back-icon">←</span>
            <span class="back-text">Back</span>
          </button>
          <h1 class="page-title">Dashboard</h1>
        </div>

        <div class="header-center">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search projects, transactions, activities"
              class="search-input"
            />
          </div>
        </div>

        <div class="header-right">
          <div
            class="user-menu"
            @click.stop="toggleUserDropdown"
            :class="{ 'dropdown-active': userDropdownOpen }"
          >
            <div class="user-avatar">{{ userInitials }}</div>
            <span class="user-name">{{ user.name }}</span>
            <span class="dropdown-arrow" :class="{ rotated: userDropdownOpen }">▼</span>
          </div>

          <!-- User Profile Dropdown -->
          <div v-if="userDropdownOpen" class="user-dropdown" @click.stop>
            <div class="dropdown-header">
              <div class="dropdown-avatar">{{ userInitials }}</div>
              <div class="dropdown-user-info">
                <div class="dropdown-name">{{ user.name }}</div>
                <div class="dropdown-email">{{ user.email }}</div>
                <div class="dropdown-role">{{ store.role || 'User' }}</div>
              </div>
            </div>

            <div class="dropdown-divider"></div>

            <div class="dropdown-menu">
              <button class="dropdown-item" @click="navigateToProfile">
                <span class="dropdown-icon">👤</span>
                <span class="dropdown-text">Profile Settings</span>
              </button>
              <button class="dropdown-item" @click="navigateToWallet">
                <span class="dropdown-icon">💰</span>
                <span class="dropdown-text">Wallet</span>
              </button>
              <button class="dropdown-item" @click="navigateToCertificates">
                <span class="dropdown-icon">📜</span>
                <span class="dropdown-text">Certificates</span>
              </button>
              <button class="dropdown-item" @click="navigateToSettings">
                <span class="dropdown-icon">⚙️</span>
                <span class="dropdown-text">Settings</span>
              </button>
            </div>

            <div class="dropdown-divider"></div>

            <div class="dropdown-menu">
              <button class="dropdown-item logout-item" @click="handleLogout">
                <span class="dropdown-icon">🚪</span>
                <span class="dropdown-text">Log out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Dashboard Content -->
      <div class="dashboard-content">
        <h1>Welcome to Carbonify Dashboard</h1>
        <p>Manage your carbon credits, projects, and transactions.</p>
        <div class="dashboard-stats">
          <div class="stat-card">
            <h3>Total Credits</h3>
            <p>1,250</p>
          </div>
          <div class="stat-card">
            <h3>Active Projects</h3>
            <p>5</p>
          </div>
          <div class="stat-card">
            <h3>Transactions</h3>
            <p>12</p>
          </div>
        </div>
      </div>

      <!-- Mobile Menu Overlay -->
      <div v-if="mobileMenuOpen" class="mobile-overlay" @click="mobileMenuOpen = false"></div>
    </div>
  </div>
</template>

<style scoped>
.home-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
  background: #f8fafc;
}

/* Sidebar Styles */
.sidebar {
  background: #10b981;
  color: white;
  display: flex;
  flex-direction: column;
  padding: 20px 16px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px 24px 8px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  position: relative;
}

.logo-circles {
  position: relative;
  width: 100%;
  height: 100%;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: white;
}

.circle-1 {
  width: 20px;
  height: 20px;
  top: 2px;
  left: 2px;
  opacity: 0.9;
}

.circle-2 {
  width: 16px;
  height: 16px;
  top: 8px;
  left: 8px;
  opacity: 0.7;
}

.brand-text {
  font-size: 18px;
  font-weight: 700;
  color: white;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: white;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
}

.nav-item.logout {
  margin-top: auto;
  margin-bottom: 0;
  color: #fee2e2;
}

.nav-item.logout:hover {
  background: rgba(254, 226, 226, 0.1);
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
}

.sidebar-spacer {
  flex: 1;
}

/* Main Content */
.main-content {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

/* Header */
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.header-left .page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.header-center {
  flex: 1;
  max-width: 500px;
  margin: 0 32px;
}

.search-box {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 16px;
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 48px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  background: #f8fafc;
}

.search-input:focus {
  outline: none;
  border-color: #10b981;
  background: white;
}

.header-right .user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #0d1117;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #21262c;
  color: #f0f6fc;
}

.header-right .user-menu:hover {
  background: #21262c;
  border-color: #2f81f7;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(47, 129, 247, 0.2);
}

.header-right .user-menu.dropdown-active {
  background: #1a1f24;
  border-color: #2f81f7;
  box-shadow: 0 4px 12px rgba(47, 129, 247, 0.3);
}

.user-avatar {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #2f81f7, #10b981);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: white;
  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.3);
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #f0f6fc;
}

.dropdown-arrow {
  color: #8b949e;
  font-size: 12px;
  transition: transform 0.2s ease;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

/* User Dropdown */
.header-right {
  position: relative;
}

.user-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: #0d1117;
  border: 1px solid #21262c;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  min-width: 280px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #161b22;
  border-bottom: 1px solid #21262c;
}

.dropdown-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #2f81f7, #10b981);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: white;
  box-shadow: 0 2px 8px rgba(47, 129, 247, 0.3);
}

.dropdown-user-info {
  flex: 1;
}

.dropdown-name {
  font-size: 16px;
  font-weight: 600;
  color: #f0f6fc;
  margin-bottom: 2px;
}

.dropdown-email {
  font-size: 13px;
  color: #8b949e;
  margin-bottom: 2px;
}

.dropdown-role {
  font-size: 12px;
  color: #2f81f7;
  font-weight: 500;
  text-transform: capitalize;
}

.dropdown-divider {
  height: 1px;
  background: #21262c;
  margin: 0;
}

.dropdown-menu {
  padding: 8px 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #f0f6fc;
  font-size: 14px;
  text-align: left;
  position: relative;
}

.dropdown-item:not(:active):hover,
.dropdown-item:focus {
  background-color: #21262c;
  color: #f0f6fc;
}

.dropdown-item:focus,
.dropdown-item:active {
  background-color: #1a1f24;
  outline: none;
}

.dropdown-item::before {
  content: '';
  position: absolute;
  top: 5px;
  left: 0;
  width: 3px;
  height: 80%;
  background-color: #2f81f7;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.dropdown-item:focus::before,
.dropdown-item:active::before {
  opacity: 1;
}

.dropdown-item.logout-item {
  color: #f85149;
}

.dropdown-item.logout-item:hover {
  background-color: #2d1b1b;
}

.dropdown-item.logout-item::before {
  background-color: #f85149;
}

.dropdown-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  transition: transform 0.2s ease;
}

.dropdown-item:hover .dropdown-icon {
  transform: scale(1.1);
}

.dropdown-text {
  font-weight: 500;
}

/* Dashboard Content */
.dashboard-content {
  padding: 32px;
  flex: 1;
  overflow-y: auto;
}

.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}

.dashboard-stats .stat-card {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.dashboard-stats .stat-card h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.dashboard-stats .stat-card p {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--primary-color);
}

/* Mobile Menu Button */
.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 12px;
  color: #64748b;
}

.mobile-menu-btn:hover {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #10b981;
}

.menu-icon {
  font-size: 18px;
  font-weight: bold;
}

/* Back Button */
.back-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 16px;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.back-button:hover {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #10b981;
}

.back-icon {
  font-size: 16px;
  font-weight: bold;
}

.back-text {
  font-size: 14px;
}

/* Overview Section */
.overview-section {
  margin-bottom: 32px;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.metric-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.metric-title {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

/* Quick Actions Section */
.quick-actions-section {
  margin-bottom: 32px;
}

.quick-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  color: #1e293b;
}

.action-btn:hover {
  background: #f0fdf4;
  border-color: #bbf7d0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.action-icon {
  font-size: 32px;
}

.action-text {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

/* Mobile Overlay */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: none;
}

@media (max-width: 1024px) {
  .mobile-overlay {
    display: block;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .home-layout {
    grid-template-columns: 1fr;
  }

  .mobile-menu-btn {
    display: flex;
  }

  .sidebar {
    position: fixed;
    left: -240px;
    top: 0;
    height: 100vh;
    z-index: 1000;
    transition: left 0.3s ease;
  }

  .sidebar.open {
    left: 0;
  }

  .main-content {
    width: 100%;
  }

  .metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .dashboard-content {
    padding: 16px;
  }

  .top-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
    padding: 16px;
  }

  .header-center {
    margin: 0;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .metric-card {
    padding: 16px;
  }

  .metric-value {
    font-size: 24px;
  }

  .quick-actions-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .action-btn {
    padding: 16px;
  }

  .action-icon {
    font-size: 24px;
  }

  .action-text {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .dashboard-content {
    padding: 12px;
  }

  .top-header {
    padding: 12px;
  }

  .page-title {
    font-size: 24px;
  }

  .section-title {
    font-size: 20px;
  }

  .quick-actions-grid {
    grid-template-columns: 1fr;
  }

  .back-button {
    padding: 6px 12px;
    font-size: 12px;
  }

  /* Mobile User Dropdown */
  .user-dropdown {
    min-width: 260px;
    right: -10px;
  }

  .dropdown-header {
    padding: 12px;
  }

  .dropdown-avatar {
    width: 36px;
    height: 36px;
    font-size: 12px;
  }

  .dropdown-name {
    font-size: 14px;
  }

  .dropdown-email {
    font-size: 12px;
  }

  .dropdown-item {
    padding: 10px 12px;
    font-size: 13px;
  }

  .dropdown-icon {
    font-size: 14px;
    width: 18px;
  }
}
</style>
