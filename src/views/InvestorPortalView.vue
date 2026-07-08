<script setup>
import { ref, computed, onMounted } from 'vue'
import { getInvestmentPipeline, documentCount } from '@/services/investorService'
import { FEATURES } from '@/constants/plans'
import FeatureGate from '@/components/ui/FeatureGate.vue'
import CategoryChart from '@/components/charts/CategoryChart.vue'

const loading = ref(true)
const loadError = ref('')
const projects = ref([])
const summary = ref(null)
const categoryFilter = ref('')
const detail = ref(null) // selected project for the financial modal

function peso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function num(n) {
  return Number(n || 0).toLocaleString('en-PH')
}
function pct(v) {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

const categories = computed(() => summary.value?.byCategory.map((c) => c.category) || [])
const filtered = computed(() =>
  categoryFilter.value ? projects.value.filter((p) => p.category === categoryFilter.value) : projects.value,
)

const chartData = computed(() => {
  const cats = summary.value?.byCategory || []
  const palette = ['#069e2d', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308']
  return {
    labels: cats.map((c) => c.category),
    datasets: [{ data: cats.map((c) => c.grossRevenue), backgroundColor: cats.map((_, i) => palette[i % palette.length]) }],
  }
})
const chartOptions = { plugins: { title: { display: true, text: 'Pipeline value by category' } } }
const hasChart = computed(() => (summary.value?.byCategory.length || 0) > 0)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getInvestmentPipeline()
    projects.value = res.projects
    summary.value = res.summary
  } catch (err) {
    console.error('Failed to load investor pipeline:', err)
    loadError.value = err?.message || 'We could not load the investment pipeline right now.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="investor">
    <header class="page-head">
      <h1>Investor Portal</h1>
      <p>The validated project pipeline — credit supply, projected value, financial returns, and funding needs.</p>
    </header>

    <FeatureGate
      :feature="FEATURES.INVESTOR_PORTAL"
      title="Investor Portal is a Pro feature"
      message="Upgrade to Pro to access the project pipeline, financial models (IRR/NPV), and funding data."
    >
      <div v-if="loading" class="muted">Loading pipeline…</div>

      <div v-else-if="loadError" class="notice error">
        <span class="material-symbols-outlined" aria-hidden="true">error</span>
        <div class="notice-body">
          <strong>Couldn't load the pipeline.</strong>
          {{ loadError }}
          <div><button class="retry-btn" @click="load">Try again</button></div>
        </div>
      </div>

      <template v-else-if="summary && summary.projects">
        <!-- Summary cards -->
        <section class="cards">
          <div class="card">
            <div class="card-label">Pipeline projects</div>
            <div class="card-value">{{ num(summary.projects) }}</div>
            <div class="muted small">{{ num(summary.credits) }} credits available</div>
          </div>
          <div class="card">
            <div class="card-label">Projected value</div>
            <div class="card-value">{{ peso(summary.grossRevenue) }}</div>
            <div class="muted small">gross, at listed prices</div>
          </div>
          <div class="card">
            <div class="card-label">Funding gap</div>
            <div class="card-value">{{ peso(summary.fundingGap) }}</div>
            <div class="muted small">of {{ peso(summary.fundingTarget) }} sought</div>
          </div>
          <div class="card">
            <div class="card-label">Avg. modelled IRR</div>
            <div class="card-value">{{ pct(summary.avgIrr) }}</div>
            <div class="muted small">{{ num(summary.withFinancials) }} project(s) with financials</div>
          </div>
        </section>

        <section v-if="hasChart" class="chart-wrap">
          <div class="chart-card">
            <CategoryChart :data="chartData" :options="chartOptions" />
          </div>
        </section>

        <!-- Pipeline table -->
        <section class="panel">
          <div class="panel-head">
            <h2>Project pipeline</h2>
            <select v-model="categoryFilter" class="filter">
              <option value="">All categories</option>
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th class="num">Credits</th>
                  <th class="num">Price</th>
                  <th class="num">Gross value</th>
                  <th class="num">IRR</th>
                  <th class="num">Funding gap</th>
                  <th class="num">Docs</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in filtered" :key="p.id">
                  <td>
                    <router-link :to="`/projects/${p.id}`" class="proj-link">{{ p.title }}</router-link>
                    <div class="muted small">{{ p.category }}<span v-if="p.location"> · {{ p.location }}</span></div>
                  </td>
                  <td class="num">{{ num(p.estimated_credits) }}</td>
                  <td class="num">{{ p.credit_price ? peso(p.credit_price) : '—' }}</td>
                  <td class="num">{{ peso(p.financials.grossRevenue) }}</td>
                  <td class="num">
                    <span v-if="p.financials.irr != null" class="irr">{{ pct(p.financials.irr) }}</span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="num">{{ p.financials.fundingGap != null ? peso(p.financials.fundingGap) : '—' }}</td>
                  <td class="num">{{ documentCount(p) }}</td>
                  <td class="num">
                    <button class="link-btn" @click="detail = p">Financials</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="muted small legend">
            IRR/NPV/payback are modelled from developer-provided CAPEX, OPEX and project lifetime;
            projects without those show “—”. Open a project to view its data room (documents).
          </p>
        </section>
      </template>

      <div v-else class="empty">
        <span class="material-symbols-outlined empty-icon" aria-hidden="true">insights</span>
        <h2>No validated projects yet</h2>
        <p class="muted">Once developers have validated projects, the investable pipeline appears here.</p>
        <router-link to="/marketplace" class="btn-primary">Browse the marketplace</router-link>
      </div>
    </FeatureGate>

    <!-- Financial detail modal -->
    <div v-if="detail" class="modal-overlay" @click.self="detail = null">
      <div class="modal">
        <h2>{{ detail.title }}</h2>
        <p class="muted small">{{ detail.category }}<span v-if="detail.location"> · {{ detail.location }}</span></p>

        <div class="fin-grid">
          <div class="fin"><span class="fin-l">Projected gross value</span><span class="fin-v">{{ peso(detail.financials.grossRevenue) }}</span></div>
          <div class="fin"><span class="fin-l">Estimated credits</span><span class="fin-v">{{ num(detail.estimated_credits) }}</span></div>
          <div class="fin"><span class="fin-l">Credit price</span><span class="fin-v">{{ detail.credit_price ? peso(detail.credit_price) : '—' }}</span></div>
          <div class="fin"><span class="fin-l">Capacity</span><span class="fin-v">{{ detail.capacity != null ? num(detail.capacity) + ' ' + (detail.capacity_unit || '') : '—' }}</span></div>
        </div>

        <template v-if="detail.financials.hasFinancials">
          <h3>Financial model</h3>
          <div class="fin-grid">
            <div class="fin"><span class="fin-l">CAPEX</span><span class="fin-v">{{ peso(detail.financials.capex) }}</span></div>
            <div class="fin"><span class="fin-l">OPEX / yr</span><span class="fin-v">{{ peso(detail.financials.opex) }}</span></div>
            <div class="fin"><span class="fin-l">Lifetime</span><span class="fin-v">{{ num(detail.financials.lifetimeYears) }} yrs</span></div>
            <div class="fin"><span class="fin-l">Annual net</span><span class="fin-v">{{ peso(detail.financials.annualNet) }}</span></div>
            <div class="fin highlight"><span class="fin-l">IRR</span><span class="fin-v">{{ pct(detail.financials.irr) }}</span></div>
            <div class="fin highlight"><span class="fin-l">NPV (10%)</span><span class="fin-v">{{ peso(detail.financials.npv) }}</span></div>
            <div class="fin"><span class="fin-l">Payback</span><span class="fin-v">{{ detail.financials.paybackYears != null ? num(detail.financials.paybackYears) + ' yrs' : '—' }}</span></div>
          </div>
        </template>
        <p v-else class="notice info sm">
          The developer hasn't provided CAPEX / OPEX / lifetime for this project, so a full return
          model (IRR/NPV/payback) isn't available yet.
        </p>

        <div v-if="detail.financials.fundingTarget != null" class="funding">
          <strong>Funding:</strong> {{ peso(detail.financials.fundingRaised || 0) }} raised of
          {{ peso(detail.financials.fundingTarget) }} — gap {{ peso(detail.financials.fundingGap) }}.
        </div>

        <div class="modal-actions">
          <router-link :to="`/projects/${detail.id}`" class="btn-ghost">Open project & data room</router-link>
          <button class="btn-primary" @click="detail = null">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.investor { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
.page-head h1 { margin: 0; font-size: 1.6rem; }
.page-head p { color: #6b7280; margin: 4px 0 20px; max-width: 640px; }
.muted { color: #6b7280; }
.small { font-size: 0.8rem; }
.notice { display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; border-radius: 10px; margin-bottom: 20px; }
.notice.error { background: #fee2e2; color: #991b1b; }
.notice.info { background: #eff6ff; color: #1e40af; }
.notice.sm { padding: 8px 12px; font-size: 0.85rem; margin: 12px 0 0; }
.notice-body { display: flex; flex-direction: column; gap: 4px; }
.retry-btn { margin-top: 8px; padding: 6px 14px; border: 1px solid currentColor; background: transparent; color: inherit; border-radius: 8px; font-weight: 600; cursor: pointer; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
.card-label { color: #6b7280; font-size: 0.85rem; }
.card-value { font-size: 1.5rem; font-weight: 700; margin: 6px 0; }
.chart-wrap { margin-bottom: 24px; }
.chart-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; max-width: 520px; }
.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin-bottom: 20px; }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.panel-head h2 { margin: 0; font-size: 1.1rem; }
.filter { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; }
.table-scroll { width: 100%; overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; white-space: nowrap; }
.data-table th.num, .data-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.proj-link { color: #069e2d; font-weight: 600; text-decoration: none; }
.proj-link:hover { text-decoration: underline; }
.irr { color: #065f46; font-weight: 600; }
.link-btn { background: none; border: none; color: #069e2d; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
.legend { margin: 12px 0 0; }
.btn-primary { background: #069e2d; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; cursor: pointer; font-weight: 600; text-decoration: none; display: inline-block; }
.btn-ghost { background: #fff; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 16px; cursor: pointer; font-weight: 600; text-decoration: none; }
.empty { text-align: center; padding: 48px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
.empty-icon { font-size: 48px; color: #069e2d; }
.empty h2 { margin: 12px 0 6px; }
.empty p { max-width: 420px; margin: 0 auto 18px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.modal { background: #fff; border-radius: 16px; padding: 24px; max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; }
.modal h2 { margin: 0 0 2px; }
.modal h3 { margin: 18px 0 10px; font-size: 1rem; }
.fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.fin { display: flex; flex-direction: column; gap: 2px; background: #f9fafb; border: 1px solid #f1f5f9; border-radius: 8px; padding: 10px; }
.fin.highlight { background: #ecfdf5; border-color: #bbf7d0; }
.fin-l { font-size: 0.75rem; color: #6b7280; }
.fin-v { font-size: 1.05rem; font-weight: 700; color: #111827; }
.funding { margin-top: 14px; padding: 10px 12px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; font-size: 0.88rem; color: #92400e; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
@media (max-width: 640px) {
  .cards { grid-template-columns: 1fr; }
  .fin-grid { grid-template-columns: 1fr; }
}
</style>
