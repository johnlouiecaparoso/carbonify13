<template>
  <div class="connection-status">
    <div class="status-header">
      <h3>
        <span class="material-symbols-outlined" aria-hidden="true">link</span>
        Connection Status
      </h3>
      <button @click="refreshStatus" :disabled="loading" class="refresh-btn">
        <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
        {{ loading ? 'Checking...' : 'Refresh' }}
      </button>
    </div>

    <div class="status-grid">
      <div v-for="service in services" :key="service.name" :class="['status-item', service.status]">
        <div class="status-icon">
          <span v-if="getStatusIcon(service.status) === 'check_circle'" class="material-symbols-outlined" aria-hidden="true">check_circle</span>
          <span v-else-if="getStatusIcon(service.status) === 'warning'" class="material-symbols-outlined" aria-hidden="true">warning</span>
          <span v-else-if="getStatusIcon(service.status) === 'error'" class="material-symbols-outlined" aria-hidden="true">error</span>
          <span v-else class="material-symbols-outlined" aria-hidden="true">hourglass_top</span>
        </div>
        <div class="status-content">
          <div class="service-name">{{ service.name }}</div>
          <div class="service-status">{{ service.message }}</div>
          <div v-if="service.details" class="service-details">
            {{ service.details }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="overallStatus !== 'connected'" class="status-actions">
      <button @click="refreshStatus" class="btn btn-primary">Retry All Connections</button>
      <button @click="showDetails = !showDetails" class="btn btn-outline">
        {{ showDetails ? 'Hide' : 'Show' }} Details
      </button>
    </div>

    <div v-if="showDetails" class="status-details">
      <h4>Connection Details</h4>
      <div class="details-content">
        <div v-for="service in services" :key="service.name" class="detail-item">
          <strong>{{ service.name }}:</strong>
          <pre>{{ JSON.stringify(service.debug, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getSupabase } from '@/services/supabaseClient'
import { projectService } from '@/services/projectService'
import { getWalletBalance } from '@/services/walletService'
import { getMarketplaceListings } from '@/services/marketplaceService'
import { useUserStore } from '@/store/userStore'

const loading = ref(false)
const showDetails = ref(false)
const services = ref([])

const userStore = useUserStore()

const overallStatus = computed(() => {
  const connectedCount = services.value.filter((s) => s.status === 'connected').length
  const totalCount = services.value.length

  if (connectedCount === totalCount) return 'connected'
  if (connectedCount > 0) return 'partial'
  return 'disconnected'
})

function getStatusIcon(status) {
  switch (status) {
    case 'connected':
      return 'check_circle'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'hourglass_top'
  }
}

async function testSupabaseConnection() {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return {
        status: 'error',
        message: 'Client not initialized',
        debug: { error: 'Supabase client not available' },
      }
    }

    // Test auth session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Test database connection
    const { error } = await supabase.from('profiles').select('count').limit(1)

    if (error) {
      return {
        status: 'error',
        message: `Database error: ${error.message}`,
        debug: { error: error.message, code: error.code },
      }
    }

    return {
      status: 'connected',
      message: session ? `Connected (${session.user.email})` : 'Connected (no session)',
      debug: {
        hasSession: !!session,
        userEmail: session?.user?.email,
        databaseTest: 'success',
      },
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Connection failed: ${error.message}`,
      debug: { error: error.message, stack: error.stack },
    }
  }
}

async function testProjectService() {
  try {
    const stats = await projectService.getProjectStats()
    return {
      status: 'connected',
      message: `${stats.total} projects found`,
      debug: { stats, service: 'projectService' },
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Service error: ${error.message}`,
      debug: { error: error.message, service: 'projectService' },
    }
  }
}

async function testWalletService() {
  try {
    const wallet = await getWalletBalance()
    return {
      status: 'connected',
      message: `Balance: $${wallet.current_balance}`,
      debug: { wallet, service: 'walletService' },
    }
  } catch (error) {
    return {
      status: 'warning',
      message: `Wallet issue: ${error.message}`,
      debug: { error: error.message, service: 'walletService' },
    }
  }
}

async function testMarketplaceService() {
  try {
    const listings = await getMarketplaceListings()
    return {
      status: 'connected',
      message: `${listings.length} listings available`,
      debug: { listingsCount: listings.length, service: 'marketplaceService' },
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Service error: ${error.message}`,
      debug: { error: error.message, service: 'marketplaceService' },
    }
  }
}

async function testUserStore() {
  try {
    return {
      status: userStore.isAuthenticated ? 'connected' : 'warning',
      message: userStore.isAuthenticated
        ? `User: ${userStore.profile?.full_name || 'Unknown'}`
        : 'Not authenticated',
      debug: {
        isAuthenticated: userStore.isAuthenticated,
        role: userStore.role,
        profile: userStore.profile,
        service: 'userStore',
      },
    }
  } catch (error) {
    return {
      status: 'error',
      message: `Store error: ${error.message}`,
      debug: { error: error.message, service: 'userStore' },
    }
  }
}

async function refreshStatus() {
  loading.value = true

  try {
    const results = await Promise.allSettled([
      testSupabaseConnection(),
      testProjectService(),
      testWalletService(),
      testMarketplaceService(),
      testUserStore(),
    ])

    services.value = [
      {
        name: 'Supabase Database',
        ...(results[0].value || { status: 'error', message: 'Test failed' }),
      },
      {
        name: 'Project Service',
        ...(results[1].value || { status: 'error', message: 'Test failed' }),
      },
      {
        name: 'Wallet Service',
        ...(results[2].value || { status: 'error', message: 'Test failed' }),
      },
      {
        name: 'Marketplace Service',
        ...(results[3].value || { status: 'error', message: 'Test failed' }),
      },
      { name: 'User Store', ...(results[4].value || { status: 'error', message: 'Test failed' }) },
    ]
  } catch (error) {
    console.error('Error testing connections:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshStatus()
})
</script>

<style scoped>
.connection-status {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.status-header h3 {
  margin: 0;
  color: #374151;
}

.refresh-btn {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.status-item.connected {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.status-item.warning {
  background: #fffbeb;
  border-color: #fed7aa;
}

.status-item.error {
  background: #fef2f2;
  border-color: #fecaca;
}

.status-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.status-content {
  flex: 1;
}

.service-name {
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}

.service-status {
  color: #6b7280;
  font-size: 0.875rem;
}

.service-details {
  color: #9ca3af;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.status-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-outline {
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.btn-outline:hover {
  background: #f9fafb;
}

.status-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.status-details h4 {
  margin: 0 0 1rem 0;
  color: #374151;
}

.details-content {
  background: #f9fafb;
  border-radius: 6px;
  padding: 1rem;
}

.detail-item {
  margin-bottom: 1rem;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-item strong {
  color: #374151;
  display: block;
  margin-bottom: 0.5rem;
}

.detail-item pre {
  background: white;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
  font-size: 0.75rem;
  overflow-x: auto;
  margin: 0;
}
</style>
