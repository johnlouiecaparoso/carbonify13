<template>
  <div class="admin-dashboard">
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="page-title">Admin Dashboard</h1>
        <p class="page-description">Oversee platform access, roles, and core settings</p>
      </div>
    </div>
    <div class="admin-stats">
      <div class="stat-card">
        <h3>Total Users</h3>
        <p class="stat-number">{{ loading ? '...' : stats.totalUsers }}</p>
      </div>
      <div class="stat-card">
        <h3>Pending Role Applications</h3>
        <p class="stat-number">{{ loading ? '...' : stats.pendingRoleApplications }}</p>
      </div>
      <div class="stat-card">
        <h3>Administrators</h3>
        <p class="stat-number">{{ loading ? '...' : stats.totalAdmins }}</p>
      </div>
      <div class="stat-card">
        <h3>Pending Verifier Applicants</h3>
        <p class="stat-number">{{ loading ? '...' : stats.pendingVerifierApplications }}</p>
      </div>
    </div>

    <div class="admin-content">
      <!-- Admin Tools Section -->
      <div class="admin-section">
        <h2>Admin Tools</h2>
        <p>System administration and management tools.</p>

        <div class="admin-tools-grid">
          <router-link to="/admin/users" class="admin-tool-card">
            <div class="tool-icon" aria-hidden="true">
              <span class="material-symbols-outlined">group</span>
            </div>
            <h3>User Management</h3>
            <p>Manage user accounts, roles, and permissions</p>
          </router-link>

          <router-link to="/admin/finance" class="admin-tool-card">
            <div class="tool-icon" aria-hidden="true">
              <span class="material-symbols-outlined">account_balance</span>
            </div>
            <h3>Finance Console</h3>
            <p>Sales, fees, payouts, and book reconciliation</p>
          </router-link>

          <router-link to="/admin/audit-logs" class="admin-tool-card">
            <div class="tool-icon" aria-hidden="true">
              <span class="material-symbols-outlined">assignment</span>
            </div>
            <h3>Audit Logs</h3>
            <p>View system activity and user actions</p>
          </router-link>

          <router-link to="/admin/kyc" class="admin-tool-card">
            <div class="tool-icon" aria-hidden="true">
              <span class="material-symbols-outlined">verified_user</span>
            </div>
            <h3>KYC Review</h3>
            <p>Approve identity verification applications</p>
          </router-link>

          <router-link to="/admin/config" class="admin-tool-card">
            <div class="tool-icon" aria-hidden="true">
              <span class="material-symbols-outlined">tune</span>
            </div>
            <h3>System Configuration</h3>
            <p>Platform fee, KYC tiers, and emission factors</p>
          </router-link>
        </div>
      </div>

      <div class="admin-section">
        <div class="section-header">
          <div>
            <h2>Verifier Applicant Approval</h2>
            <p>Review and approve verifier applicants directly from the admin dashboard.</p>
          </div>
          <router-link to="/admin/role-applications" class="section-link">
            Open Full Role Applications
          </router-link>
        </div>

        <RoleApplications :embedded="true" :show-header="false" role-filter="verifier" />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSupabase, getSupabaseAsync } from '@/services/supabaseClient'
import { diagnoseAdminDashboard } from '@/utils/diagnoseAdminDashboard'
import { debugAdminQueries } from '@/utils/debugAdminQueries'
import RoleApplications from '@/components/admin/RoleApplications.vue'

const stats = ref({
  totalUsers: 0,
  pendingRoleApplications: 0,
  totalAdmins: 0,
  pendingVerifierApplications: 0,
})

const loading = ref(true)

onMounted(async () => {
  await loadStats()

  // If stats are all zero, run diagnostics
  if (stats.value.totalUsers === 0 && stats.value.pendingRoleApplications === 0) {
    console.warn('[WARN] All stats are zero, running diagnostics...')
    console.log(
      '💡 You can also run debugAdminQueries() or diagnoseAdminDashboard() in console manually',
    )
    setTimeout(async () => {
      try {
        // Run enhanced debug queries first
        const debugResult = await debugAdminQueries()
        console.log('[DEBUG] Debug result:', debugResult)

        // Also run full diagnostics
        const result = await diagnoseAdminDashboard()
        if (!result.success || stats.value.totalUsers === 0) {
          console.error('[ERROR] Diagnostics found issues. Check logs above for details.')
          console.log('💡 To debug queries: await debugAdminQueries()')
          console.log('💡 To full diagnose: await diagnoseAdminDashboard()')
        }
      } catch (err) {
        console.error('[ERROR] Diagnostic function error:', err)
      }
    }, 2000) // Wait 2 seconds to let stats finish loading
  }
})

async function loadStats() {
  try {
    loading.value = true

    // Ensure Supabase is initialized before proceeding
    let supabase = getSupabase()
    if (!supabase) {
      console.log('Supabase not ready, initializing...')
      supabase = await getSupabaseAsync()
    }

    if (!supabase) {
      console.error('Supabase client not initialized in AdminDashboard')
      stats.value = {
        totalUsers: 0,
        pendingRoleApplications: 0,
        totalAdmins: 0,
        pendingVerifierApplications: 0,
      }
      return
    }

    const [
      { count: totalUsersCount, error: totalUsersError },
      { count: adminCount, error: adminError },
      { count: pendingRoleApplicationsCount, error: pendingRoleApplicationsError },
      { count: pendingVerifierApplicationsCount, error: pendingVerifierApplicationsError },
    ] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase
        .from('role_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('role_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('role_requested', 'verifier'),
    ])

    if (totalUsersError) {
      console.error('Error counting users:', totalUsersError)
    }
    if (adminError) {
      console.error('Error counting admin users:', adminError)
    }
    if (pendingRoleApplicationsError) {
      console.error('Error counting pending role applications:', pendingRoleApplicationsError)
    }
    if (pendingVerifierApplicationsError) {
      console.error('Error counting pending verifier applications:', pendingVerifierApplicationsError)
    }

    stats.value.totalUsers = totalUsersCount || 0
    stats.value.totalAdmins = adminCount || 0
    stats.value.pendingRoleApplications = pendingRoleApplicationsCount || 0
    stats.value.pendingVerifierApplications = pendingVerifierApplicationsCount || 0
  } catch (error) {
    console.error('Error loading admin stats:', error)
    // Set defaults on error
    stats.value = {
      totalUsers: 0,
      pendingRoleApplications: 0,
      totalAdmins: 0,
      pendingVerifierApplications: 0,
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  background: var(--bg-secondary, #f8fdf8);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Page Header */
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

.admin-dashboard .admin-stats,
.admin-dashboard .admin-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
}

.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stat-card h3 {
  margin: 0 0 0.5rem 0;
  color: #666;
  font-size: 0.9rem;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: #333;
  margin: 0;
}

.admin-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.admin-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.admin-section h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.5rem;
}

.admin-section p {
  margin: 0 0 1.5rem 0;
  color: #666;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.section-header p {
  margin-bottom: 0;
}

.section-link {
  align-self: center;
  text-decoration: none;
  color: var(--primary-color, #069e2d);
  font-weight: 600;
}

.admin-tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.admin-tool-card {
  display: block;
  padding: 1.5rem;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
}

.admin-tool-card:hover {
  background: #e9ecef;
  border-color: #007bff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 1rem;
  border-radius: 8px;
  background: #e6f4f1;
  color: var(--primary-color, #0f766e);
}

.tool-icon .material-symbols-outlined {
  font-size: 28px;
}

.admin-tool-card h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.1rem;
}

.admin-tool-card p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}

.admin-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.admin-section h2 {
  margin: 0 0 1rem 0;
  color: #333;
}

.admin-section p {
  color: #666;
  line-height: 1.5;
}
</style>
