<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageLayout from '@/components/layout/PageLayout.vue'
import {
  getPlatformOverview,
  getProjectStats,
  getCreditStats,
  getUserStats,
  getRevenueStats,
  getTopProjects,
  getRecentActivity
} from '@/services/analyticsService'

const router = useRouter()

// State
const loading = ref(true)
const error = ref(null)
const overview = ref({})
const projectStats = ref({})
const creditStats = ref({})
const userStats = ref({})
const revenueStats = ref({})
const topProjects = ref([])
const recentActivity = ref([])

// Computed properties for display
const formatCurrency = (amount, currency = 'PHP') => {
  if (amount >= 1000000) {
    return `${currency} ${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${currency} ${(amount / 1000).toFixed(1)}K`
  }
  return `${currency} ${amount.toLocaleString()}`
}

const formatNumber = (num) => {
  return num.toLocaleString()
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Load analytics data
async function loadAnalytics() {
  try {
    loading.value = true
    error.value = null

    const [
      overviewData,
      projectStatsData,
      creditStatsData,
      userStatsData,
      revenueStatsData,
      topProjectsData,
      recentActivityData
    ] = await Promise.all([
      getPlatformOverview(),
      getProjectStats(),
      getCreditStats(),
      getUserStats(),
      getRevenueStats(),
      getTopProjects(),
      getRecentActivity()
    ])

    overview.value = overviewData
    projectStats.value = projectStatsData
    creditStats.value = creditStatsData
    userStats.value = userStatsData
    revenueStats.value = revenueStatsData
    topProjects.value = topProjectsData
    recentActivity.value = recentActivityData
  } catch (err) {
    console.error('Error loading analytics:', err)
    error.value = err.message || 'Failed to load analytics data'
  } finally {
    loading.value = false
  }
}

// Generate report
async function generateReport() {
  try {
    // This would typically generate and download a PDF/Excel report
    // For now, we'll just log the data
    console.log('Generating report with data:', {
      overview: overview.value,
      projectStats: projectStats.value,
      creditStats: creditStats.value,
      userStats: userStats.value,
      revenueStats: revenueStats.value,
      topProjects: topProjects.value,
      recentActivity: recentActivity.value
    })

    alert('Report generated successfully! Check the console for data.')
  } catch (err) {
    console.error('Error generating report:', err)
    alert('Failed to generate report. Please try again.')
  }
}

onMounted(() => {
  loadAnalytics()
})
</script>

<template>
  <PageLayout>
    <div class="analytics-content">
      <div class="content-header">
        <div class="header-info">
          <button class="btn btn-ghost back-btn" @click="router.push('/dashboard')">
            <span class="back-icon">←</span>
            Back to Dashboard
          </button>
          <h1 class="page-title">Analytics & Reports</h1>
          <p class="page-subtitle">View insights and generate reports</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary" @click="generateReport" :disabled="loading">📊 Generate Report</button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading analytics data...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to Load Analytics</h3>
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="loadAnalytics">Retry</button>
      </div>

      <!-- Analytics Content -->
      <div v-else class="analytics-grid">
        <!-- Key Metrics -->
        <div class="metrics-cards">
          <div class="metric-card">
            <div class="metric-icon">🌱</div>
            <div class="metric-content">
              <h3>Active Projects</h3>
              <p class="metric-number">{{ formatNumber(overview.activeProjects || 0) }}</p>
              <span class="metric-change neutral">{{ formatNumber(overview.totalProjects || 0) }} total</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">💰</div>
            <div class="metric-content">
              <h3>Total Revenue</h3>
              <p class="metric-number">{{ formatCurrency(overview.totalRevenue || 0, overview.currency) }}</p>
              <span class="metric-change neutral">{{ formatNumber(overview.totalTransactions || 0) }} transactions</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">👥</div>
            <div class="metric-content">
              <h3>Total Users</h3>
              <p class="metric-number">{{ formatNumber(overview.totalUsers || 0) }}</p>
              <span class="metric-change neutral">{{ formatNumber(overview.totalCreditsSold || 0) }} credits sold</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🌍</div>
            <div class="metric-content">
              <h3>CO2 Reduced</h3>
              <p class="metric-number">2.3K tons</p>
              <span class="metric-change positive">+15%</span>
            </div>
          </div>
        </div>

        <!-- Data Tables Section -->
        <div class="data-section">
          <div class="data-card">
            <div class="card-header">
              <h3>Project Statistics</h3>
            </div>
            <div class="data-content">
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">By Status:</span>
                  <div class="stat-values">
                    <span v-for="(count, status) in projectStats.byStatus" :key="status" class="stat-value">
                      {{ status }}: {{ count }}
                    </span>
                  </div>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Monthly Growth:</span>
                  <div class="stat-values">
                    <span v-for="month in projectStats.byMonth.slice(-6)" :key="month.month" class="stat-value">
                      {{ month.month }}: {{ month.count }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="data-card">
            <div class="card-header">
              <h3>Credit Trading Statistics</h3>
            </div>
            <div class="data-content">
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">Available Credits:</span>
                  <span class="stat-value">{{ formatNumber(creditStats.totalCreditsAvailable || 0) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Credits Sold:</span>
                  <span class="stat-value">{{ formatNumber(creditStats.totalCreditsSold || 0) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Average Price:</span>
                  <span class="stat-value">{{ formatCurrency(creditStats.averagePrice || 0) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Total Volume:</span>
                  <span class="stat-value">{{ formatCurrency(creditStats.totalVolume || 0) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Projects Section -->
        <div class="top-projects-section">
          <div class="data-card">
            <div class="card-header">
              <h3>Top Performing Projects</h3>
            </div>
            <div class="data-content">
              <div v-if="topProjects.length === 0" class="empty-state">
                <div class="empty-icon">📊</div>
                <p>No projects with credit sales yet</p>
              </div>
              <div v-else class="projects-list">
                <div v-for="project in topProjects.slice(0, 5)" :key="project.id" class="project-item">
                  <div class="project-info">
                    <h4>{{ project.title }}</h4>
                    <p class="project-category">{{ project.category }}</p>
                  </div>
                  <div class="project-stats">
                    <span class="credits-sold">{{ formatNumber(project.creditsSold) }} credits sold</span>
                    <span class="revenue">{{ formatCurrency(project.revenue) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activity Section -->
        <div class="activity-section">
          <div class="data-card">
            <div class="card-header">
              <h3>Recent Activity</h3>
            </div>
            <div class="data-content">
              <div v-if="recentActivity.length === 0" class="empty-state">
                <div class="empty-icon">📝</div>
                <p>No recent activity</p>
              </div>
              <div v-else class="activity-list">
                <div v-for="activity in recentActivity.slice(0, 10)" :key="activity.id" class="activity-item">
                  <div class="activity-icon">
                    <span v-if="activity.type === 'project'">🌱</span>
                    <span v-else-if="activity.type === 'transaction'">💰</span>
                    <span v-else">📝</span>
                  </div>
                  <div class="activity-content">
                    <p class="activity-title">{{ activity.title }}</p>
                    <p class="activity-meta">{{ formatDate(activity.timestamp) }}</p>
                  </div>
                  <div class="activity-status">
                    <span :class="['status-badge', activity.status || 'neutral']">
                      {{ activity.action || 'Activity' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Reports Section -->
        <div class="reports-section">
          <div class="reports-card">
            <div class="card-header">
              <h3>Available Reports</h3>
              <button class="btn btn-secondary">+ Create Custom Report</button>
            </div>
            <div class="reports-grid">
              <div class="report-item">
                <div class="report-icon">📋</div>
                <div class="report-info">
                  <h4>Monthly Summary</h4>
                  <p>Overview of all activities and metrics</p>
                </div>
                <button class="btn btn-ghost">Download</button>
              </div>
              <div class="report-item">
                <div class="report-icon">🌱</div>
                <div class="report-info">
                  <h4>Project Analysis</h4>
                  <p>Detailed project performance report</p>
                </div>
                <button class="btn btn-ghost">Download</button>
              </div>
              <div class="report-item">
                <div class="report-icon">👥</div>
                <div class="report-info">
                  <h4>User Activity</h4>
                  <p>User engagement and activity metrics</p>
                </div>
                <button class="btn btn-ghost">Download</button>
              </div>
              <div class="report-item">
                <div class="report-icon">💰</div>
                <div class="report-info">
                  <h4>Financial Report</h4>
                  <p>Revenue, expenses, and financial metrics</p>
                </div>
                <button class="btn btn-ghost">Download</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.analytics-content {
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

.analytics-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.metrics-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.metric-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--shadow-md);
}

.metric-icon {
  font-size: 2rem;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--carbonify-primary-50);
  border-radius: 8px;
}

.metric-content {
  flex: 1;
}

.metric-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--carbonify-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-number {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--carbonify-text);
}

.metric-change {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.metric-change.positive {
  background: #d1fae5;
  color: #065f46;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background: var(--carbonify-primary-50);
  border-bottom: 1px solid var(--carbonify-primary-200);
}

.chart-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--carbonify-primary-700);
}

.chart-controls {
  display: flex;
  gap: 1rem;
}

.period-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--carbonify-border);
  border-radius: 6px;
  background: var(--carbonify-surface);
  color: var(--carbonify-text);
  font-size: 0.875rem;
}

.chart-content {
  padding: 2rem;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-chart {
  text-align: center;
  color: var(--carbonify-muted);
}

.chart-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.reports-section {
  margin-top: 1rem;
}

.reports-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  background: var(--carbonify-primary-50);
  border-bottom: 1px solid var(--carbonify-primary-200);
}

.card-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--carbonify-primary-700);
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
}

.report-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: 8px;
  transition: all 0.2s;
}

.report-item:hover {
  background: var(--carbonify-primary-50);
  border-color: var(--carbonify-primary-300);
}

.report-icon {
  font-size: 1.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--carbonify-primary-100);
  border-radius: 6px;
}

.report-info {
  flex: 1;
  min-width: 0;
}

.report-info h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.report-info p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--carbonify-muted);
}

/* Responsive */
@media (max-width: 768px) {
  .content-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .metrics-cards {
    grid-template-columns: 1fr;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }

  .reports-grid {
    grid-template-columns: 1fr;
  }

  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
}

/* Loading and Error States */
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--carbonify-border);
  border-top: 3px solid var(--carbonify-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* Data Sections */
.data-section, .top-projects-section, .activity-section {
  margin-bottom: 32px;
}

.data-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--carbonify-border);
  background: var(--carbonify-bg);
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.data-content {
  padding: 24px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-label {
  font-weight: 600;
  color: var(--carbonify-text);
  font-size: 14px;
}

.stat-values {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stat-value {
  background: var(--carbonify-primary-50);
  color: var(--carbonify-primary);
  padding: 4px 8px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
}

/* Projects List */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
}

.project-info h4 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.project-category {
  margin: 0;
  font-size: 14px;
  color: var(--carbonify-muted);
}

.project-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.credits-sold {
  font-size: 14px;
  color: var(--carbonify-text);
  font-weight: 500;
}

.revenue {
  font-size: 14px;
  color: var(--carbonify-primary);
  font-weight: 600;
}

/* Activity List */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
}

.activity-icon {
  font-size: 20px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--carbonify-primary-50);
  border-radius: var(--radius);
}

.activity-content {
  flex: 1;
}

.activity-title {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--carbonify-text);
}

.activity-meta {
  margin: 0;
  font-size: 12px;
  color: var(--carbonify-muted);
}

.status-badge {
  padding: 4px 8px;
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.approved {
  background: var(--carbonify-success-bg);
  color: var(--carbonify-success);
}

.status-badge.submitted {
  background: var(--carbonify-warning-bg);
  color: var(--carbonify-warning);
}

.status-badge.purchase {
  background: var(--carbonify-primary-50);
  color: var(--carbonify-primary);
}

.status-badge.neutral {
  background: var(--carbonify-muted-bg);
  color: var(--carbonify-muted);
}

/* Empty States */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  color: var(--carbonify-muted);
  font-size: 14px;
}
</style>

