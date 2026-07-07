<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/userStore'
import { ROLES, PERMISSIONS } from '@/constants/roles'
import { projectService } from '@/services/projectService'
import { getWalletBalance } from '@/services/walletService'
import UserProfile from './UserProfile.vue'
import ConnectionStatus from '@/components/dashboard/ConnectionStatus.vue'

const userStore = useUserStore()

const activeTab = ref('overview')
const userStats = ref({
  projects: 0,
  walletBalance: 0,
  kycLevel: 0,
})

const recentProjects = ref([])
const projectStats = ref({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
})

const tabs = computed(() => {
  const baseTabs = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'profile', label: 'Profile', icon: 'person' },
  ]

  // Add role-specific tabs - only show for Project Developers
  if (userStore.isProjectDeveloper) {
    baseTabs.push({ id: 'projects', label: 'My Projects', icon: 'folder' })
  }

  if (userStore.hasPermission(PERMISSIONS.MANAGE_WALLET)) {
    baseTabs.push({ id: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' })
  }

  return baseTabs
})

const userRole = computed(() => userStore.role)
const userProfile = computed(() => userStore.profile)

const roleDisplayName = computed(() => {
  switch (userRole.value) {
    case ROLES.SUPER_ADMIN:
      return 'Super Administrator'
    case ROLES.ADMIN:
      return 'Administrator'
    case ROLES.VERIFIER:
      return 'Verifier'
    case ROLES.USER:
    default:
      return 'User'
  }
})

const quickActions = computed(() => {
  const actions = []

  // Only allow Project Developers to create projects
  if (userStore.isProjectDeveloper) {
    actions.push({
      id: 'create-project',
      label: 'Create Project',
      icon: 'add',
      action: () => {
        // Navigate to submit project page
        window.location.href = '/submit-project'
      },
    })
  }

  if (userStore.hasPermission(PERMISSIONS.VIEW_MARKETPLACE)) {
    actions.push({
      id: 'browse-marketplace',
      label: 'Browse Marketplace',
      icon: 'storefront',
      action: () => {
        // Navigate to marketplace
        window.location.href = '/marketplace'
      },
    })
  }

  if (userStore.hasPermission(PERMISSIONS.MANAGE_WALLET)) {
    actions.push({
      id: 'manage-wallet',
      label: 'Manage Wallet',
      icon: 'account_balance_wallet',
      action: () => {
        // Navigate to wallet
        window.location.href = '/wallet'
      },
    })
  }

  return actions
})

async function loadUserStats() {
  try {
    // Load project statistics
    const projects = await projectService.getUserProjects()
    await projectService.getProjectStats()

    // Load wallet balance
    let walletBalance = 0
    try {
      const wallet = await getWalletBalance()
      walletBalance = wallet.current_balance || 0
    } catch (error) {
      console.error('Error loading wallet balance:', error)
      // Fallback to 0 if wallet not found
    }

    userStats.value = {
      projects: projects.length,
      walletBalance: walletBalance,
      kycLevel: userProfile.value?.kyc_level || 0,
    }

    // Update project stats
    projectStats.value = {
      total: projects.length,
      pending: projects.filter((p) => p.status === 'pending').length,
      approved: projects.filter((p) => p.status === 'approved').length,
      rejected: projects.filter((p) => p.status === 'rejected').length,
    }

    // Get recent projects (last 3)
    recentProjects.value = projects
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3)
  } catch (error) {
    console.error('Error loading user stats:', error)
    // Fallback to mock data
    userStats.value = {
      projects: 0,
      walletBalance: 0,
      kycLevel: userProfile.value?.kyc_level || 0,
    }
  }
}

onMounted(() => {
  loadUserStats()
})
</script>

<template>
  <div class="user-dashboard">
    <div class="welcome-section">
      <h1>Welcome back, {{ userProfile?.full_name || 'User' }}!</h1>
      <p>You're logged in as a {{ roleDisplayName.toLowerCase() }}</p>
    </div>

    <!-- Connection Status Component -->
    <ConnectionStatus />

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon material-symbols-outlined" aria-hidden="true">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </div>

    <div class="tab-content">
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="overview">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined" aria-hidden="true">folder</span></div>
            <div class="stat-content">
              <h3>{{ userStats.projects }}</h3>
              <p>Total Projects</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined" aria-hidden="true">schedule</span></div>
            <div class="stat-content">
              <h3>{{ projectStats.pending }}</h3>
              <p>Pending Review</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span></div>
            <div class="stat-content">
              <h3>{{ projectStats.approved }}</h3>
              <p>Approved</p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-icon"><span class="material-symbols-outlined" aria-hidden="true">account_balance_wallet</span></div>
            <div class="stat-content">
              <h3>${{ userStats.walletBalance.toLocaleString() }}</h3>
              <p>Wallet Balance</p>
            </div>
          </div>
        </div>

        <div class="quick-actions-section">
          <h3>Quick Actions</h3>
          <div class="quick-actions">
            <button
              v-for="action in quickActions"
              :key="action.id"
              class="action-btn"
              @click="action.action"
            >
              <span class="action-icon material-symbols-outlined" aria-hidden="true">{{ action.icon }}</span>
              {{ action.label }}
            </button>
          </div>
        </div>

        <div class="recent-activity">
          <h3>Recent Projects</h3>
          <div v-if="recentProjects.length === 0" class="no-projects">
            <p>No projects yet. Create your first project to get started!</p>
            <button
              class="action-btn"
              @click="() => (window.location.href = '/projects?action=create')"
            >
              <span class="action-icon material-symbols-outlined" aria-hidden="true">add</span>
              Create Project
            </button>
          </div>
          <div v-else class="activity-list">
            <div
              v-for="project in recentProjects"
              :key="project.id"
              class="activity-item"
              @click="() => (window.location.href = '/projects')"
            >
              <div class="activity-icon"><span class="material-symbols-outlined" aria-hidden="true">folder</span></div>
              <div class="activity-content">
                <p>{{ project.title }}</p>
                <span class="activity-time">
                  {{ new Date(project.created_at).toLocaleDateString() }}
                  • {{ project.status }}
                </span>
                <span
                  v-if="project.status === 'rejected' && project.verification_notes"
                  class="activity-note"
                >
                  Rejection note: {{ project.verification_notes }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Profile Tab -->
      <div v-else-if="activeTab === 'profile'" class="profile">
        <UserProfile />
      </div>

      <!-- Projects Tab -->
      <div v-else-if="activeTab === 'projects'" class="projects">
        <div class="placeholder">
          <div class="placeholder-icon"><span class="material-symbols-outlined" aria-hidden="true">folder</span></div>
          <h3>My Projects</h3>
          <p>Project management functionality will be implemented here</p>
        </div>
      </div>

      <!-- Wallet Tab -->
      <div v-else-if="activeTab === 'wallet'" class="wallet">
        <div class="placeholder">
          <div class="placeholder-icon"><span class="material-symbols-outlined" aria-hidden="true">account_balance_wallet</span></div>
          <h3>Wallet</h3>
          <p>Wallet management functionality will be implemented here</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-dashboard {
  padding: 24px;
}

.welcome-section {
  margin-bottom: 32px;
}

.welcome-section h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 800;
  color: #1e293b;
}

.welcome-section p {
  margin: 0;
  color: #64748b;
  font-size: 16px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  border-bottom: 1px solid #e2e8f0;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: #1e293b;
  background: #f8fafc;
}

.tab.active {
  color: #10b981;
  border-bottom-color: #10b981;
}

.tab-icon {
  font-size: 16px;
}

.tab-content {
  min-height: 400px;
}

.overview {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 32px;
}

.stat-content h3 {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

.stat-content p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.quick-actions-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.quick-actions-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.action-btn:hover {
  background: var(--primary-color, #10b981);
  color: #fff;
  border-color: var(--primary-color, #10b981);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.action-icon {
  font-size: 20px;
}

.recent-activity {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.recent-activity h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.activity-item:hover {
  background: #f0fdf4;
  transform: translateY(-1px);
}

.activity-icon {
  font-size: 20px;
}

.activity-content {
  flex: 1;
}

.activity-content p {
  margin: 0 0 4px 0;
  color: #1e293b;
  font-weight: 500;
}

.activity-time {
  color: #64748b;
  font-size: 12px;
}

.activity-note {
  display: block;
  margin-top: 4px;
  color: #b45309;
  font-size: 12px;
}

.no-projects {
  text-align: center;
  padding: 40px 20px;
  color: #64748b;
}

.no-projects p {
  margin: 0 0 16px 0;
  font-size: 16px;
}

.no-projects .action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.no-projects .action-btn:hover {
  background: #059669;
}

.placeholder {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.placeholder h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}

.placeholder p {
  margin: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .user-dashboard {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .quick-actions {
    grid-template-columns: 1fr;
  }

  .tabs {
    flex-wrap: wrap;
  }
}
</style>
