<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { getProfile } from '@/services/profileService'

const router = useRouter()
const store = useUserStore()

const user = ref({ name: 'Carbonify User', email: 'user@carbonify.io' })

// Metrics data
const metrics = ref([
  { id: 'mrr', title: 'Current MRR', value: '$12.4k' },
  { id: 'customers', title: 'Current Customers', value: '16,601' },
  { id: 'active', title: 'Active Customers', value: '33%' },
  { id: 'churn', title: 'Churn Rate', value: '2%' },
])

// Search functionality
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)

// Navigation items - Enhanced for dashboard focus
const navItems = [
  { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: '📊' },
  { id: 'wallet', label: 'Wallet', route: '/wallet', icon: '💰' },
  { id: 'transactions', label: 'Transactions', route: '/marketplace', icon: '🔄' },
  { id: 'projects', label: 'Projects', route: '/projects', icon: '🌱' },
  { id: 'marketplace', label: 'Marketplace', route: '/marketplace', icon: '🏪' },
  { id: 'sales', label: 'Sales', route: '/sales', icon: '📈' },
  { id: 'analytics', label: 'Analytics', route: '/analytics', icon: '📊' },
]

// Chart data
const trendData = ref([
  { month: 'Jan', new: 5000, renewals: 8000, churns: 2000 },
  { month: 'Feb', new: 6000, renewals: 8500, churns: 1500 },
  { month: 'Mar', new: 7000, renewals: 9000, churns: 1800 },
  { month: 'Apr', new: 5500, renewals: 9200, churns: 2200 },
  { month: 'May', new: 8000, renewals: 8800, churns: 1600 },
  { month: 'Jun', new: 7500, renewals: 9500, churns: 1900 },
  { month: 'Jul', new: 9000, renewals: 9800, churns: 2100 },
])

const salesData = ref({
  total: 342,
  plans: [
    { name: 'BASIC PLAN', value: 120, color: '#10b981' },
    { name: 'ADVANCED PLAN', value: 150, color: '#059669' },
    { name: 'PRO PLAN', value: 50, color: '#047857' },
    { name: 'ENTERPRISE PLAN', value: 22, color: '#065f46' },
  ],
})

const transactions = ref([
  { name: 'S. Evergreen', plan: 'PRO', amount: '+$49' },
  { name: 'A. Martinez', plan: 'ADVANCED', amount: '+$99' },
  { name: 'J. Wilson', plan: 'BASIC', amount: '+$29' },
  { name: 'M. Chen', plan: 'ENTERPRISE', amount: '+$199' },
  { name: 'R. Johnson', plan: 'PRO', amount: '+$49' },
])

const supportTickets = ref([
  { email: 'jessica.smith123@example.com', issue: 'Login Issue', status: 'OPEN' },
  { email: 'mike.wilson@company.com', issue: 'Payment Problem', status: 'PENDING' },
  { email: 'sarah.davis@gmail.com', issue: 'Feature Request', status: 'CLOSED' },
  { email: 'tom.brown@startup.io', issue: 'Account Setup', status: 'OPEN' },
])

const selectedFilter = ref('All')
const timeRange = ref('This year')

// User profile dropdown functionality
const userDropdownOpen = ref(false)

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

function navigateTo(route) {
  router.push(route)
}

// Search functionality
async function performSearch() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    // Simulate search - replace with actual search API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Mock search results
    searchResults.value = [
      {
        type: 'project',
        title: 'Solar Farm Project',
        description: 'Renewable energy project in California',
        route: '/projects',
      },
      {
        type: 'transaction',
        title: 'Carbon Credit Purchase',
        description: 'Transaction #12345 - 100 credits',
        route: '/wallet',
      },
      { type: 'user', title: 'John Smith', description: 'Project Developer', route: '/users' },
    ].filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.value.toLowerCase()),
    )
  } catch (error) {
    console.error('Search error:', error)
  } finally {
    isSearching.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
}

function selectSearchResult(result) {
  navigateTo(result.route)
  clearSearch()
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

async function loadUserProfile() {
  if (!store.session?.user?.id) return

  try {
    const profile = await getProfile(store.session.user.id)
    if (profile) {
      user.value.name = profile.full_name || 'Carbonify User'
      user.value.email = store.session.user.email || 'user@carbonify.io'
    }
  } catch (error) {
    console.error('Error loading profile:', error)
  }
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
    <aside class="sidebar">
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
          <h1 class="page-title">Dashboard</h1>
        </div>

        <div class="header-center">
          <div class="search-container">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                v-model="searchQuery"
                @input="performSearch"
                @keyup.enter="performSearch"
                type="text"
                placeholder="Search projects, transactions, users, activities..."
                class="search-input"
              />
              <button v-if="searchQuery" @click="clearSearch" class="clear-search-btn">×</button>
              <div v-if="isSearching" class="search-loading">⏳</div>
            </div>

            <!-- Search Results Dropdown -->
            <div v-if="searchResults.length > 0" class="search-results">
              <div
                v-for="result in searchResults"
                :key="result.title"
                class="search-result-item"
                @click="selectSearchResult(result)"
              >
                <div class="result-icon">
                  {{
                    result.type === 'project' ? '🌱' : result.type === 'transaction' ? '💰' : '👤'
                  }}
                </div>
                <div class="result-content">
                  <div class="result-title">{{ result.title }}</div>
                  <div class="result-description">{{ result.description }}</div>
                </div>
              </div>
            </div>
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

      <!-- Metrics Cards -->
      <section class="metrics-section">
        <div class="metric-card" v-for="metric in metrics" :key="metric.id">
          <div class="metric-title">{{ metric.title }}</div>
          <div class="metric-value">{{ metric.value }}</div>
        </div>
      </section>

      <!-- Dashboard Grid -->
      <section class="dashboard-grid">
        <!-- Trend Chart (Large) -->
        <div class="dashboard-card large">
          <div class="card-header">
            <h3 class="card-title">Trend</h3>
            <div class="card-controls">
              <div class="legend">
                <div class="legend-item">
                  <div class="legend-color new"></div>
                  <span>NEW</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color renewals"></div>
                  <span>RENEWALS</span>
                </div>
                <div class="legend-item">
                  <div class="legend-color churns"></div>
                  <span>CHURNS</span>
                </div>
              </div>
              <select v-model="timeRange" class="time-selector">
                <option value="This year">This year</option>
                <option value="Last year">Last year</option>
                <option value="All time">All time</option>
              </select>
            </div>
          </div>
          <div class="chart-container">
            <div class="bar-chart">
              <div v-for="data in trendData" :key="data.month" class="chart-month">
                <div class="month-label">{{ data.month }}</div>
                <div class="bars">
                  <div class="bar new" :style="{ height: data.new / 1000 + 'px' }"></div>
                  <div class="bar renewals" :style="{ height: data.renewals / 1000 + 'px' }"></div>
                  <div class="bar churns" :style="{ height: data.churns / 1000 + 'px' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sales Chart -->
        <div class="dashboard-card medium">
          <div class="card-header">
            <h3 class="card-title">Sales</h3>
            <select v-model="timeRange" class="time-selector">
              <option value="This year">This year</option>
            </select>
          </div>
          <div class="sales-chart">
            <div class="donut-chart">
              <div class="donut-center">
                <div class="sales-number">{{ salesData.total }}</div>
                <div class="sales-label">SALES</div>
              </div>
            </div>
            <div class="sales-legend">
              <div v-for="plan in salesData.plans" :key="plan.name" class="legend-item">
                <div class="legend-color" :style="{ backgroundColor: plan.color }"></div>
                <span>{{ plan.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactions List -->
        <div class="dashboard-card medium">
          <div class="card-header">
            <h3 class="card-title">Transactions</h3>
          </div>
          <div class="transactions-list">
            <div
              v-for="transaction in transactions"
              :key="transaction.name"
              class="transaction-item"
            >
              <div class="transaction-info">
                <div class="transaction-name">{{ transaction.name }}</div>
                <div
                  class="transaction-plan"
                  :class="'plan-' + transaction.plan.toLowerCase().replace(' ', '-')"
                >
                  {{ transaction.plan }}
                </div>
              </div>
              <div class="transaction-amount">{{ transaction.amount }}</div>
            </div>
            <button class="view-all-btn">View all transactions</button>
          </div>
        </div>

        <!-- Support Tickets -->
        <div class="dashboard-card large">
          <div class="card-header">
            <h3 class="card-title">Support Tickets</h3>
            <div class="card-controls">
              <div class="filter-tabs">
                <button
                  v-for="filter in ['All', 'Open', 'Pending', 'Closed']"
                  :key="filter"
                  :class="['filter-tab', { active: selectedFilter === filter }]"
                  @click="selectedFilter = filter"
                >
                  {{ filter }}
                </button>
              </div>
              <select v-model="timeRange" class="time-selector">
                <option value="This week">This week</option>
              </select>
            </div>
          </div>
          <div class="tickets-list">
            <div v-for="ticket in supportTickets" :key="ticket.email" class="ticket-item">
              <div class="ticket-status" :class="'status-' + ticket.status.toLowerCase()"></div>
              <div class="ticket-info">
                <div class="ticket-email">{{ ticket.email }}</div>
                <div class="ticket-issue">{{ ticket.issue }}</div>
              </div>
              <div class="ticket-badge" :class="'badge-' + ticket.status.toLowerCase()">
                {{ ticket.status }}
              </div>
            </div>
          </div>
        </div>

        <!-- Customer Demographic -->
        <div class="dashboard-card large">
          <div class="card-header">
            <h3 class="card-title">Customer Demographic</h3>
          </div>
          <div class="demographic-content">
            <div class="demographic-legend">
              <div class="legend-item">
                <div class="legend-color active"></div>
                <span>ACTIVE</span>
              </div>
              <div class="legend-item">
                <div class="legend-color inactive"></div>
                <span>INACTIVE</span>
              </div>
            </div>
            <div class="world-map">
              <div class="map-placeholder">🌍</div>
              <div class="map-label">World Map</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  min-height: 100vh;
  background: var(--background);
}

/* Sidebar Styles */
.sidebar {
  background: var(--eco-gradient);
  color: white;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
}

.sidebar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="sidebar-grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.05"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.05"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.05"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.05"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.05"/></pattern></defs><rect width="100" height="100" fill="url(%23sidebar-grain)"/></svg>');
  opacity: 0.3;
  pointer-events: none;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 2rem 0.5rem;
  position: relative;
  z-index: 1;
}

.brand-logo {
  width: 2.5rem;
  height: 2.5rem;
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
  background: rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-sm);
}

.circle-1 {
  width: 1.25rem;
  height: 1.25rem;
  top: 0.125rem;
  left: 0.125rem;
  opacity: 0.9;
}

.circle-2 {
  width: 1rem;
  height: 1rem;
  top: 0.5rem;
  left: 0.5rem;
  opacity: 0.7;
}

.brand-text {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: white;
  letter-spacing: -0.025em;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: relative;
  z-index: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  text-align: left;
  cursor: pointer;
  border-radius: var(--radius);
  transition: all var(--transition-fast);
  font-size: var(--font-size-sm);
  font-weight: 500;
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
  position: relative;
  z-index: 1;
}

.nav-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  position: relative;
  z-index: 1;
}

/* Main Content */
.main-content {
  display: flex;
  flex-direction: column;
  background: var(--background);
  min-height: 100vh;
}

/* Header */
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.header-left .page-title {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  color: var(--foreground);
  margin: 0;
  letter-spacing: -0.025em;
}

.header-center {
  flex: 1;
  max-width: 32rem;
  margin: 0 2rem;
}

.search-box {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--carbonify-gray-400);
  font-size: 1rem;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 3rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: var(--font-size-sm);
  background: var(--input-background);
  color: var(--foreground);
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--background);
  box-shadow:
    0 0 0 3px rgba(6, 158, 45, 0.1),
    var(--shadow-md);
}

.search-input::placeholder {
  color: var(--muted-foreground);
}

/* Enhanced Search Styles */
.search-container {
  position: relative;
  width: 100%;
}

.clear-search-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  color: #6b7280;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.clear-search-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.search-loading {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Search Results Dropdown */
.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 4px;
}

.search-result-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f3f4f6;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: #f9fafb;
}

.result-icon {
  font-size: 20px;
  margin-right: 12px;
  width: 24px;
  text-align: center;
}

.result-content {
  flex: 1;
}

.result-title {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
  margin-bottom: 2px;
}

.result-description {
  color: #6b7280;
  font-size: 12px;
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
  font-size: 16px;
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

/* Metrics Section */
.metrics-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  padding: 2rem;
}

.metric-card {
  background: var(--primary);
  color: white;
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  text-align: center;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--primary);
  position: relative;
  overflow: hidden;
  transition: all var(--transition-fast);
}

.metric-card::before {
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

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.metric-card:hover::before {
  opacity: 1;
}

.metric-title {
  font-size: var(--font-size-sm);
  font-weight: 500;
  opacity: 0.9;
  margin-bottom: 0.5rem;
  position: relative;
  z-index: 1;
  letter-spacing: 0.025em;
}

.metric-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  position: relative;
  z-index: 1;
  letter-spacing: -0.025em;
}

/* Dashboard Grid */
.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: auto auto;
  gap: 1.5rem;
  padding: 0 2rem 2rem 2rem;
}

.dashboard-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}

.dashboard-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.dashboard-card.large {
  grid-column: span 1;
}

.dashboard-card.medium {
  grid-column: span 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
  letter-spacing: -0.025em;
}

.card-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-selector {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

/* Trend Chart */
.legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.new {
  background: #10b981;
}
.legend-color.renewals {
  background: #059669;
}
.legend-color.churns {
  background: #86efac;
}

.bar-chart {
  display: flex;
  align-items: end;
  gap: 12px;
  height: 200px;
}

.chart-month {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.month-label {
  font-size: 12px;
  color: #64748b;
}

.bars {
  display: flex;
  align-items: end;
  gap: 2px;
  height: 160px;
}

.bar {
  width: 8px;
  border-radius: 2px 2px 0 0;
}

.bar.new {
  background: #10b981;
}
.bar.renewals {
  background: #059669;
}
.bar.churns {
  background: #86efac;
}

/* Sales Chart */
.sales-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.donut-chart {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(
    #10b981 0deg 126deg,
    #059669 126deg 252deg,
    #047857 252deg 306deg,
    #065f46 306deg 360deg
  );
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.donut-chart::before {
  content: '';
  width: 60px;
  height: 60px;
  background: white;
  border-radius: 50%;
  position: absolute;
}

.donut-center {
  z-index: 1;
  text-align: center;
}

.sales-number {
  font-size: 24px;
  font-weight: 700;
  color: #10b981;
}

.sales-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.sales-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

/* Transactions */
.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.transaction-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transaction-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.transaction-plan {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  color: white;
  font-weight: 500;
}

.transaction-plan.plan-pro {
  background: #10b981;
}
.transaction-plan.plan-advanced {
  background: #059669;
}
.transaction-plan.plan-basic {
  background: #86efac;
  color: #065f46;
}
.transaction-plan.plan-enterprise {
  background: #047857;
}

.transaction-amount {
  font-size: 14px;
  font-weight: 600;
  color: #10b981;
}

.view-all-btn {
  width: 100%;
  padding: 12px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 8px;
}

/* Support Tickets */
.filter-tabs {
  display: flex;
  gap: 8px;
}

.filter-tab {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab.active {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.tickets-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ticket-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.ticket-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ticket-status.status-open {
  background: #10b981;
}
.ticket-status.status-pending {
  background: #f59e0b;
}
.ticket-status.status-closed {
  background: #6b7280;
}

.ticket-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ticket-email {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.ticket-issue {
  font-size: 12px;
  color: #64748b;
}

.ticket-badge {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.ticket-badge.badge-open {
  background: #dcfce7;
  color: #166534;
}
.ticket-badge.badge-pending {
  background: #fef3c7;
  color: #92400e;
}
.ticket-badge.badge-closed {
  background: #f3f4f6;
  color: #374151;
}

/* Customer Demographic */
.demographic-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.demographic-legend {
  display: flex;
  gap: 16px;
}

.demographic-legend .legend-color.active {
  background: #10b981;
}
.demographic-legend .legend-color.inactive {
  background: #86efac;
}

.world-map {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  background: #f8fafc;
  border-radius: 8px;
}

.map-placeholder {
  font-size: 48px;
  margin-bottom: 8px;
}

.map-label {
  font-size: 14px;
  color: #64748b;
}

/* Responsive */
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-card.large,
  .dashboard-card.medium {
    grid-column: span 1;
  }
}

@media (max-width: 768px) {
  .home-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    display: none;
  }

  .metrics-section {
    grid-template-columns: repeat(2, 1fr);
  }

  .top-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .header-center {
    margin: 0;
  }
}
</style>
