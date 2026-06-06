<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/userStore'
import { generateCarbonImpactReport } from '@/services/receiptService'
import { formatDate } from '@/utils/formatDate'
import PortfolioChart from '@/components/charts/PortfolioChart.vue'
import CategoryChart from '@/components/charts/CategoryChart.vue'

// User store and state
const userStore = useUserStore()
const loading = ref(false)
const error = ref('')
const carbonImpactData = ref(null)

// Chart data
const portfolioChartData = ref({
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  datasets: [
    {
      label: 'Portfolio Value ($)',
      data: [8500, 9200, 8800, 10500, 11200, 10800, 12450, 11800, 13200, 12800, 13500, 12450],
      borderColor: 'rgb(16, 185, 129)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
})

// Load carbon impact data
const loadCarbonImpactData = async () => {
  if (!userStore.user?.id) return

  loading.value = true
  error.value = ''

  try {
    const impactReport = await generateCarbonImpactReport(userStore.user.id)
    carbonImpactData.value = impactReport

    // Update category chart data with real data
    if (impactReport.categoryBreakdown) {
      const categories = Object.keys(impactReport.categoryBreakdown)
      const categoryData = categories.map(
        (category) => impactReport.categoryBreakdown[category].credits,
      )
      const totalCredits = categoryData.reduce((sum, credits) => sum + credits, 0)

      categoryChartData.value.labels = categories
      categoryChartData.value.datasets[0].data = categoryData.map((credits) =>
        totalCredits > 0 ? Math.round((credits / totalCredits) * 100) : 0,
      )
    }
  } catch (err) {
    console.error('Error loading carbon impact data:', err)
    error.value = 'Failed to load impact data'
  } finally {
    loading.value = false
  }
}

const portfolioChartOptions = ref({
  plugins: {
    title: {
      display: true,
      text: 'Portfolio Value Over Time',
    },
  },
  scales: {
    y: {
      beginAtZero: false,
      min: 8000,
      ticks: {
        callback: function (value) {
          return '$' + value.toLocaleString()
        },
      },
    },
  },
})

const categoryChartData = ref({
  labels: ['Forestry', 'Renewable Energy', 'Blue Carbon', 'Energy Efficiency', 'Waste Management'],
  datasets: [
    {
      data: [35, 25, 15, 15, 10],
      backgroundColor: [
        'rgba(16, 185, 129, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(139, 92, 246, 0.8)',
        'rgba(245, 158, 11, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
      borderColor: [
        'rgba(16, 185, 129, 1)',
        'rgba(59, 130, 246, 1)',
        'rgba(139, 92, 246, 1)',
        'rgba(245, 158, 11, 1)',
        'rgba(239, 68, 68, 1)',
      ],
      borderWidth: 2,
    },
  ],
})

const categoryChartOptions = ref({
  plugins: {
    title: {
      display: true,
      text: 'Credit Purchases by Category (%)',
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          return context.label + ': ' + context.parsed + '%'
        },
      },
    },
  },
})

// Load data on component mount
onMounted(() => {
  loadCarbonImpactData()
})
</script>

<template>
  <div class="analytics-view">
    <div class="container">
      <h1 class="page-title">Analytics Dashboard</h1>
      <p class="page-description">Track your carbon credit portfolio performance and impact.</p>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner">⏳</div>
        <p>Loading analytics data...</p>
      </div>

      <!-- Error State -->
      <div v-if="error" class="error-state">
        <div class="error-icon">❌</div>
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="loadCarbonImpactData">Retry</button>
      </div>

      <!-- Analytics Cards -->
      <div v-else class="analytics-grid">
        <div class="analytics-card">
          <div class="card-header">
            <h3>Portfolio Value</h3>
            <span class="card-icon">💰</span>
          </div>
          <div class="card-content">
            <div class="metric-value">
              ${{ carbonImpactData?.summary?.totalAmountSpent?.toLocaleString() || '0' }}
            </div>
            <div class="metric-change positive">
              {{ carbonImpactData?.summary?.totalTransactions || 0 }} transactions
            </div>
          </div>
        </div>

        <div class="analytics-card">
          <div class="card-header">
            <h3>Credits Purchased</h3>
            <span class="card-icon">🌱</span>
          </div>
          <div class="card-content">
            <div class="metric-value">
              {{ carbonImpactData?.summary?.totalCreditsPurchased?.toLocaleString() || '0' }}
            </div>
            <div class="metric-change positive">
              Avg: ${{ Math.round(carbonImpactData?.summary?.averagePricePerCredit || 0) }}/credit
            </div>
          </div>
        </div>

        <div class="analytics-card">
          <div class="card-header">
            <h3>CO₂ Offset</h3>
            <span class="card-icon">🌍</span>
          </div>
          <div class="card-content">
            <div class="metric-value">
              {{
                carbonImpactData?.environmentalImpact?.co2OffsetTonnes?.toLocaleString() || '0'
              }}
              tons
            </div>
            <div class="metric-change positive">
              Equivalent to
              {{ carbonImpactData?.environmentalImpact?.equivalentTreesPlanted || 0 }} trees
            </div>
          </div>
        </div>

        <div class="analytics-card">
          <div class="card-header">
            <h3>Projects Supported</h3>
            <span class="card-icon">🏗️</span>
          </div>
          <div class="card-content">
            <div class="metric-value">
              {{ Object.keys(carbonImpactData?.categoryBreakdown || {}).length || 0 }}
            </div>
            <div class="metric-change positive">
              {{ carbonImpactData?.summary?.totalTransactions || 0 }} total purchases
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="charts-section">
        <div class="chart-card">
          <h3>Portfolio Performance</h3>
          <PortfolioChart :data="portfolioChartData" :options="portfolioChartOptions" />
        </div>

        <div class="chart-card">
          <h3>Credit Purchases by Category</h3>
          <CategoryChart :data="categoryChartData" :options="categoryChartOptions" />
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="activity-section">
        <h3>Recent Purchases</h3>
        <div class="activity-list">
          <div v-if="carbonImpactData?.recentPurchases?.length === 0" class="empty-activity">
            <p>No recent purchases found.</p>
          </div>
          <div
            v-for="purchase in carbonImpactData?.recentPurchases || []"
            :key="purchase.date"
            class="activity-item"
          >
            <div class="activity-icon">🛒</div>
            <div class="activity-content">
              <div class="activity-title">Purchased {{ purchase.credits }} credits</div>
              <div class="activity-description">
                {{ purchase.project }} - {{ purchase.category }}
              </div>
              <div class="activity-time">{{ formatDate(purchase.date) }}</div>
            </div>
            <div class="activity-value">
              {{ purchase.currency }}{{ purchase.amount.toLocaleString() }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-view {
  padding: 2rem 0;
  min-height: 100vh;
  background: var(--bg-secondary);
}

.page-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.page-description {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin: 0 0 2rem 0;
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.analytics-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.analytics-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-icon {
  font-size: 1.5rem;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-color);
}

.metric-change {
  font-size: 0.875rem;
  font-weight: 500;
}

.metric-change.positive {
  color: #10b981;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1.5rem 0;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
}

.chart-card h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.activity-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.activity-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1.5rem 0;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-muted);
  border-radius: 8px;
}

.activity-icon {
  font-size: 1.5rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.activity-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.activity-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.activity-value {
  font-weight: 600;
  color: var(--text-primary);
}

.activity-value.positive {
  color: #10b981;
}

.empty-activity {
  text-align: center;
  padding: 2rem;
  color: var(--text-muted);
}

.loading-state,
.error-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}

.loading-spinner,
.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.loading-state p,
.error-state p {
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: var(--primary-color, #069e2d);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-hover, #058e3f);
}

@media (max-width: 768px) {
  .analytics-grid {
    grid-template-columns: 1fr;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }

  .activity-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
</style>
