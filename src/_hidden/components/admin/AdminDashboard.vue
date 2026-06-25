<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/store/userStore'
import { roleService } from '@/services/roleService'
import { ROLES } from '@/constants/roles'
import RoleManagement from './RoleManagement.vue'

const userStore = useUserStore()

const activeTab = ref('overview')
const roleStats = ref({})
const loading = ref(false)
const error = ref('')

const tabs = computed(() => {
  const baseTabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'roles', label: 'Role Management', icon: '🔐' },
  ]

  // All admins can see system settings
  baseTabs.push({ id: 'settings', label: 'System Settings', icon: '⚙️' })

  return baseTabs
})

async function loadRoleStats() {
  loading.value = true
  error.value = ''

  try {
    roleStats.value = await roleService.getRoleStatistics()
  } catch (err) {
    error.value = 'Failed to load role statistics'
    console.error('Error loading role stats:', err)
  } finally {
    loading.value = false
  }
}

function getRoleDisplayName(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'Super Admins'
    case ROLES.ADMIN:
      return 'Admins'
    case ROLES.VERIFIER:
      return 'Verifiers'
    case ROLES.USER:
      return 'Users'
    default:
      return role
  }
}

function getRoleColor(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'var(--carbonify-purple-500)'
    case ROLES.ADMIN:
      return 'var(--carbonify-red-500)'
    case ROLES.VERIFIER:
      return 'var(--carbonify-blue-500)'
    case ROLES.USER:
      return 'var(--carbonify-gray-500)'
    default:
      return 'var(--carbonify-gray-500)'
  }
}

onMounted(() => {
  loadRoleStats()
})
</script>

<template>
  <div class="admin-dashboard">
    <div class="header">
      <h1>Admin Dashboard</h1>
      <p>System administration and user management</p>
    </div>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        {{ tab.label }}
      </button>
    </div>

    <div class="tab-content">
      <!-- Overview Tab -->
      <div v-if="activeTab === 'overview'" class="overview">
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Role Distribution</h3>
            <div v-if="loading" class="loading">Loading statistics...</div>
            <div v-else-if="error" class="error">{{ error }}</div>
            <div v-else class="role-stats">
              <div v-for="(count, role) in roleStats" :key="role" class="role-stat">
                <div class="role-info">
                  <span class="role-name">{{ getRoleDisplayName(role) }}</span>
                  <span class="role-count">{{ count }}</span>
                </div>
                <div class="role-bar">
                  <div
                    class="role-fill"
                    :style="{
                      width: `${(count / Object.values(roleStats).reduce((a, b) => a + b, 0)) * 100}%`,
                      backgroundColor: getRoleColor(role),
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="stat-card">
            <h3>Quick Actions</h3>
            <div class="quick-actions">
              <button class="action-btn" @click="activeTab = 'users'">
                <span class="action-icon">👥</span>
                Manage Users
              </button>
              <button class="action-btn" @click="activeTab = 'roles'">
                <span class="action-icon">🔐</span>
                Manage Roles
              </button>
              <button class="action-btn" @click="loadRoleStats()">
                <span class="action-icon">🔄</span>
                Refresh Stats
              </button>
            </div>
          </div>

          <div class="stat-card">
            <h3>System Status</h3>
            <div class="status-items">
              <div class="status-item">
                <span class="status-label">Database</span>
                <span class="status-value success">Online</span>
              </div>
              <div class="status-item">
                <span class="status-label">Authentication</span>
                <span class="status-value success">Active</span>
              </div>
              <div class="status-item">
                <span class="status-label">Role System</span>
                <span class="status-value success">Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- User Management Tab -->
      <div v-else-if="activeTab === 'users'" class="users">
        <div class="placeholder">
          <div class="placeholder-icon">👥</div>
          <h3>User Management</h3>
          <p>User management functionality will be implemented here</p>
        </div>
      </div>

      <!-- Role Management Tab -->
      <div v-else-if="activeTab === 'roles'" class="roles">
        <RoleManagement />
      </div>

      <!-- System Settings Tab (Super Admin Only) -->
      <div v-else-if="activeTab === 'settings'" class="settings">
        <div class="placeholder">
          <div class="placeholder-icon">⚙️</div>
          <h3>System Settings</h3>
          <p>System configuration and settings will be implemented here</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-dashboard {
  padding: 24px;
}

.header {
  margin-bottom: 32px;
}

.header h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 800;
  color: var(--carbonify-text);
}

.header p {
  margin: 0;
  color: var(--carbonify-muted);
  font-size: 16px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  border-bottom: 1px solid var(--carbonify-border);
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--carbonify-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: var(--carbonify-text);
  background: var(--carbonify-bg);
}

.tab.active {
  color: var(--carbonify-primary);
  border-bottom-color: var(--carbonify-primary);
}

.tab-icon {
  font-size: 16px;
}

.tab-content {
  min-height: 400px;
}

.overview {
  /* Overview styles */
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.stat-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
  padding: 24px;
}

.stat-card h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.loading,
.error {
  text-align: center;
  padding: 20px;
  color: var(--carbonify-muted);
}

.error {
  color: var(--carbonify-error);
}

.role-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.role-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.role-name {
  font-weight: 500;
  color: var(--carbonify-text);
}

.role-count {
  font-weight: 600;
  color: var(--carbonify-text);
}

.role-bar {
  height: 8px;
  background: var(--carbonify-bg);
  border-radius: 4px;
  overflow: hidden;
}

.role-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
  color: var(--carbonify-text);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--carbonify-primary-50);
  border-color: var(--carbonify-primary);
}

.action-icon {
  font-size: 16px;
}

.status-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  color: var(--carbonify-text);
}

.status-value {
  font-weight: 500;
}

.status-value.success {
  color: var(--carbonify-success);
}

.placeholder {
  text-align: center;
  padding: 60px 20px;
  color: var(--carbonify-muted);
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.placeholder h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.placeholder p {
  margin: 0;
}
</style>
