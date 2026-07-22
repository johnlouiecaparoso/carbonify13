<template>
  <div class="audit-logs">
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="page-title">Audit Logs</h1>
        <p class="page-description">View system activity and user actions</p>
      </div>
    </div>

    <div class="logs-content">
      <div class="container">
        <!-- Filters -->
        <div class="filters-bar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search logs..."
            class="search-input"
          />
          <select v-model="actionFilter" class="filter-select">
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
          </select>
          <select v-model="userFilter" class="filter-select">
            <option value="">All Users</option>
            <option v-for="user in uniqueUsers" :key="user.id" :value="user.id">
              {{ user.name }}
            </option>
          </select>
          <button @click="refreshLogs" class="refresh-btn">Refresh</button>
          <!-- Exports what is on screen, filters included: an investigation
               usually wants the narrowed set, not the whole table. -->
          <button
            class="refresh-btn"
            :disabled="!filteredLogs.length"
            :title="`Export ${filteredLogs.length} row(s) as CSV`"
            @click="exportCsv"
          >
            Export CSV
          </button>
        </div>

        <!-- Logs Table -->
        <div v-if="loading" class="loading-state">Loading audit logs...</div>
        <div v-else-if="error" class="error-state">{{ error }}</div>
        <div v-else class="logs-table">
          <div class="logs-table__scroll">
            <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in filteredLogs" :key="log.id">
                <td>{{ formatDate(log.created_at) }}</td>
                <td>{{ log.user_name || 'System' }}</td>
                <td>
                  <span class="action-badge" :class="`action-${log.action || log.action_type}`">
                    {{ log.action || log.action_type || 'N/A' }}
                  </span>
                </td>
                <td>{{ log.resource_type || 'N/A' }}</td>
                <td class="details-cell">
                  <span :title="formatDetails(log.metadata)">{{ formatDetails(log.metadata) }}</span>
                </td>
              </tr>
            </tbody>
            </table>
          </div>
          <div v-if="logs.length === 0" class="empty-state">No audit logs found.</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { searchAuditLogs } from '@/services/auditService'
import { exportAuditLogsCsv } from '@/services/adminExportService'

const logs = ref([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const actionFilter = ref('')
const userFilter = ref('')

const uniqueUsers = computed(() => {
  const userMap = new Map()
  logs.value.forEach((log) => {
    if (log.user_id && log.user_name) {
      if (!userMap.has(log.user_id)) {
        userMap.set(log.user_id, { id: log.user_id, name: log.user_name })
      }
    }
  })
  return Array.from(userMap.values())
})

function exportCsv() {
  exportAuditLogsCsv(filteredLogs.value)
}

const filteredLogs = computed(() => {
  let filtered = logs.value

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (log) =>
        log.user_name?.toLowerCase().includes(query) ||
        log.action_type?.toLowerCase().includes(query) ||
        log.resource_type?.toLowerCase().includes(query) ||
        JSON.stringify(log.metadata)?.toLowerCase().includes(query),
    )
  }

              // Filter by action
  if (actionFilter.value) {
    filtered = filtered.filter((log) => (log.action || log.action_type) === actionFilter.value)
  }

  // Filter by user
  if (userFilter.value) {
    filtered = filtered.filter((log) => log.user_id === userFilter.value)
  }

  return filtered
})

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDetails(details) {
  if (!details) return 'N/A'
  if (typeof details === 'string') return details
  return JSON.stringify(details)
}

async function loadLogs() {
  try {
    loading.value = true
    error.value = ''
    const result = await searchAuditLogs({}, 500)
    logs.value = result || []
  } catch (err) {
    console.error('Error loading audit logs:', err)
    error.value = 'Failed to load audit logs. Please try again.'
    logs.value = []
  } finally {
    loading.value = false
  }
}

async function refreshLogs() {
  await loadLogs()
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.audit-logs {
  min-height: 100vh;
  background: var(--bg-secondary, #f8fdf8);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-header {
  padding: 2rem 0;
  border-bottom: none;
  background: var(--primary-color, #10b981);
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.5rem;
}

.page-description {
  font-size: 1.1rem;
  color: #fff;
}

.logs-content {
  padding: 2rem 0;
}

.filters-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.search-input,
.filter-select {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}

.search-input {
  flex: 2;
  min-width: 200px;
}

.filter-select {
  min-width: 150px;
}

.refresh-btn {
  padding: 0.75rem 1.5rem;
  background: var(--primary-color, #10b981);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

.logs-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.logs-table__scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

thead {
  background: #f8f9fa;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

th {
  font-weight: 600;
  color: #333;
}

.details-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.action-create {
  background: #dcfce7;
  color: #16a34a;
}

.action-update {
  background: #dbeafe;
  color: #2563eb;
}

.action-delete {
  background: #fee2e2;
  color: #dc2626;
}

.action-approve {
  background: #dcfce7;
  color: #16a34a;
}

.action-reject {
  background: #fee2e2;
  color: #dc2626;
}

.action-login,
.action-logout {
  background: #f3f4f6;
  color: #6b7280;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 2rem;
}

@media (max-width: 768px) {
  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input,
  .filter-select,
  .refresh-btn {
    width: 100%;
    min-width: 0;
  }

  .logs-table {
    border-radius: 12px;
  }
}
</style>
