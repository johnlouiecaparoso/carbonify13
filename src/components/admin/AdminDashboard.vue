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
        <div class="stat-icon users" aria-hidden="true">
          <span class="material-symbols-outlined">group</span>
        </div>
        <div class="stat-body">
          <p class="stat-number">{{ loading ? '...' : stats.totalUsers }}</p>
          <h3>Total Users</h3>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon apps" aria-hidden="true">
          <span class="material-symbols-outlined">pending_actions</span>
        </div>
        <div class="stat-body">
          <p class="stat-number">{{ loading ? '...' : stats.pendingRoleApplications }}</p>
          <h3>Pending Role Applications</h3>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon admins" aria-hidden="true">
          <span class="material-symbols-outlined">shield_person</span>
        </div>
        <div class="stat-body">
          <p class="stat-number">{{ loading ? '...' : stats.totalAdmins }}</p>
          <h3>Administrators</h3>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon verifiers" aria-hidden="true">
          <span class="material-symbols-outlined">how_to_reg</span>
        </div>
        <div class="stat-body">
          <p class="stat-number">{{ loading ? '...' : stats.pendingVerifierApplications }}</p>
          <h3>Pending Verifier Applicants</h3>
        </div>
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
  padding: 2rem 0 4rem;
  border-bottom: none;
  background: linear-gradient(135deg, var(--primary-color, #069e2d) 0%, var(--primary-hover, #058e3f) 100%);
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
  margin-bottom: 0.5rem;
}

.page-description {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
}

.admin-dashboard .admin-stats,
.admin-dashboard .admin-content {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Stat cards float up over the header for a modern dashboard feel */
.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-top: -2.5rem;
  margin-bottom: 2rem;
  position: relative;
  z-index: 1;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  padding: 1.4rem 1.5rem;
  border-radius: 1rem;
  border: 1px solid #eef2f1;
  box-shadow: 0 10px 24px rgba(6, 158, 45, 0.1), 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 16px 32px rgba(6, 158, 45, 0.16);
}

.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.85rem;
  flex-shrink: 0;
}

.stat-icon .material-symbols-outlined {
  font-size: 1.6rem;
}

.stat-icon.users {
  background: #e8f5e8;
  color: #069e2d;
}
.stat-icon.apps {
  background: #fef3c7;
  color: #b45309;
}
.stat-icon.admins {
  background: #fee2e2;
  color: #b91c1c;
}
.stat-icon.verifiers {
  background: #e0f2fe;
  color: #075985;
}

.stat-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-card h3 {
  margin: 0.1rem 0 0 0;
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.stat-number {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--text-primary, #1a1a1a);
  margin: 0;
  line-height: 1.1;
}

.admin-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  background: transparent;
}

.admin-section {
  background: white;
  padding: 1.75rem;
  border-radius: 1rem;
  border: 1px solid #eef2f1;
  box-shadow: 0 4px 16px rgba(6, 158, 45, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
}

.admin-section h2 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary, #1a1a1a);
  font-size: 1.4rem;
  font-weight: 700;
  padding-left: 0.7rem;
  border-left: 3px solid var(--primary-color, #069e2d);
  line-height: 1.2;
}

.admin-section > p {
  margin: 0 0 1.5rem 0;
  color: #6b7280;
  line-height: 1.5;
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
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: var(--primary-color, #069e2d);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--border-green-light, #d4edda);
  border-radius: 999px;
  background: var(--bg-green-light, #e8f5e8);
  transition: all 0.18s ease;
}

.section-link:hover {
  background: var(--primary-color, #069e2d);
  color: #fff;
  border-color: var(--primary-color, #069e2d);
}

.admin-tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.1rem;
}

.admin-tool-card {
  display: block;
  padding: 1.5rem;
  background: #fff;
  border: 1px solid #e8edf1;
  border-radius: 0.9rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.admin-tool-card:hover {
  background: #fff;
  border-color: var(--primary-color, #069e2d);
  transform: translateY(-3px);
  box-shadow: 0 14px 28px rgba(6, 158, 45, 0.14);
}

.tool-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 1rem;
  border-radius: 0.85rem;
  background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%);
  color: var(--primary-color, #069e2d);
  transition: transform 0.2s ease;
}

.admin-tool-card:hover .tool-icon {
  transform: scale(1.06);
}

.tool-icon .material-symbols-outlined {
  font-size: 28px;
}

.admin-tool-card h3 {
  margin: 0 0 0.4rem 0;
  color: var(--text-primary, #1a1a1a);
  font-size: 1.1rem;
  font-weight: 700;
}

.admin-tool-card p {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
