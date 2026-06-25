<script setup>
import { useRouter } from 'vue-router'
import PageLayout from '@/components/layout/PageLayout.vue'

const router = useRouter()
</script>

<template>
  <PageLayout>
    <div class="users-content">
      <div class="content-header">
        <div class="header-info">
          <button class="btn btn-ghost back-btn" @click="router.push('/dashboard')">
            <span class="back-icon">←</span>
            Back to Dashboard
          </button>
          <h1 class="page-title">User Management</h1>
          <p class="page-subtitle">Manage user accounts, roles, and permissions</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary">+ Add User</button>
        </div>
      </div>

      <div class="users-grid">
        <!-- User Statistics -->
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <h3>Total Users</h3>
              <p class="stat-number">1,247</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-content">
              <h3>Active Users</h3>
              <p class="stat-number">1,156</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🆕</div>
            <div class="stat-content">
              <h3>New This Month</h3>
              <p class="stat-number">89</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔒</div>
            <div class="stat-content">
              <h3>Pending Approval</h3>
              <p class="stat-number">23</p>
            </div>
          </div>
        </div>

        <!-- User Management Table -->
        <div class="users-table-card">
          <div class="table-header">
            <h3>All Users</h3>
            <div class="table-actions">
              <input type="text" placeholder="Search users..." class="search-input" />
              <select class="filter-select">
                <option>All Roles</option>
                <option>User</option>
                <option>Verifier</option>
                <option>Admin</option>
              </select>
            </div>
          </div>
          <div class="table-content">
            <div class="placeholder-content">
              <div class="placeholder-icon">👥</div>
              <h3>User Management Coming Soon</h3>
              <p>This module will contain user management functionality including:</p>
              <ul>
                <li>User account creation and management</li>
                <li>Role and permission assignment</li>
                <li>User activity monitoring</li>
                <li>Account verification and approval</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.users-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--carbonify-border);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

.back-btn:hover {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #10b981;
}

.back-icon {
  font-size: 16px;
  font-weight: bold;
}

.header-info {
  flex: 1;
}

.page-title {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 800;
  color: var(--carbonify-text);
}

.page-subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--carbonify-muted);
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.users-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-md);
}

.stat-icon {
  font-size: 2rem;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--carbonify-primary-50);
  border-radius: 8px;
}

.stat-content {
  flex: 1;
}

.stat-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--carbonify-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-number {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--carbonify-text);
}

.users-table-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background: var(--carbonify-primary-50);
  border-bottom: 1px solid var(--carbonify-primary-200);
}

.table-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--carbonify-primary-700);
}

.table-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid var(--carbonify-border);
  border-radius: 6px;
  background: var(--carbonify-surface);
  color: var(--carbonify-text);
  font-size: 0.875rem;
  min-width: 200px;
}

.filter-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--carbonify-border);
  border-radius: 6px;
  background: var(--carbonify-surface);
  color: var(--carbonify-text);
  font-size: 0.875rem;
}

.table-content {
  padding: 2rem;
}

.placeholder-content {
  text-align: center;
  padding: 2rem;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.5;
}

.placeholder-content h3 {
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--carbonify-text);
}

.placeholder-content p {
  margin: 0 0 1.5rem 0;
  color: var(--carbonify-muted);
  font-size: 1rem;
}

.placeholder-content ul {
  text-align: left;
  max-width: 500px;
  margin: 0 auto;
  color: var(--carbonify-muted);
  font-size: 0.875rem;
}

.placeholder-content li {
  margin-bottom: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .content-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .stats-cards {
    grid-template-columns: 1fr;
  }

  .table-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .table-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    min-width: auto;
  }
}
</style>
