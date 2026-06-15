<template>
  <div class="lgu-page">
    <div class="page-header">
      <div class="container">
        <h1 class="page-title">LGU Tools</h1>
        <p class="page-description">
          Municipal solid waste emissions, diversion tracking, city ESG, and project
          endorsements.
        </p>
      </div>
    </div>

    <div class="lgu-content">
      <div class="container">
        <div class="tabs">
          <button
            v-for="t in tabs"
            :key="t.id"
            class="tab"
            :class="{ active: activeTab === t.id }"
            @click="activeTab = t.id"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- MSW Calculator -->
        <section v-if="activeTab === 'calculator'" class="panel">
          <h2>Municipal Solid Waste Emissions Calculator</h2>
          <p class="panel-sub">
            Estimate landfill methane emissions and the impact of diverting waste from
            disposal.
          </p>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Municipality / City</label>
              <input v-model="calc.municipality" class="form-input" placeholder="e.g., Cabanatuan City" />
            </div>
            <div class="form-group">
              <label class="form-label">Reporting period</label>
              <input v-model="calc.periodLabel" class="form-input" placeholder="e.g., 2026 or 2026 Q1" />
            </div>
            <div class="form-group">
              <label class="form-label">Population (optional)</label>
              <input v-model.number="calc.population" type="number" min="0" class="form-input" @input="suggestWaste" />
            </div>
            <div class="form-group">
              <label class="form-label">Waste generated (tonnes/period)</label>
              <input v-model.number="calc.wasteGenerated" type="number" min="0" step="any" class="form-input" />
              <span v-if="suggested" class="hint">Estimated from population: {{ suggested }} t/yr</span>
            </div>
            <div class="form-group">
              <label class="form-label">Waste diverted (tonnes)</label>
              <input v-model.number="calc.wasteDiverted" type="number" min="0" step="any" class="form-input" />
            </div>
          </div>

          <div class="results">
            <div class="result-card">
              <span class="result-label">Baseline emissions</span>
              <strong>{{ fmt(result.baseline) }} t CO₂e</strong>
            </div>
            <div class="result-card highlight">
              <span class="result-label">Avoided by diversion</span>
              <strong>{{ fmt(result.avoided) }} t CO₂e</strong>
            </div>
            <div class="result-card">
              <span class="result-label">Net emissions</span>
              <strong>{{ fmt(result.net) }} t CO₂e</strong>
            </div>
            <div class="result-card">
              <span class="result-label">Diversion rate</span>
              <strong>{{ result.diversionRate.toFixed(1) }}%</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <textarea v-model="calc.notes" class="form-textarea" rows="2"></textarea>
          </div>

          <p v-if="message" class="message" :class="{ error: isError }">{{ message }}</p>
          <button class="btn btn-primary" @click="saveRecord" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save Record' }}
          </button>
        </section>

        <!-- Records & diversion -->
        <section v-else-if="activeTab === 'records'" class="panel">
          <h2>Records & Waste Diversion</h2>
          <div v-if="loadingRecords" class="muted">Loading…</div>
          <div v-else-if="records.length === 0" class="muted">No records yet. Use the calculator to add one.</div>
          <table v-else class="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Municipality</th>
                <th>Generated (t)</th>
                <th>Diverted (t)</th>
                <th>Diversion %</th>
                <th>Net t CO₂e</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in records" :key="r.id">
                <td>{{ r.period_label || '—' }}</td>
                <td>{{ r.municipality || '—' }}</td>
                <td>{{ fmt(r.waste_generated_tonnes) }}</td>
                <td>{{ fmt(r.waste_diverted_tonnes) }}</td>
                <td>{{ diversionPct(r) }}%</td>
                <td>{{ fmt(r.net_emissions_tco2e) }}</td>
                <td><button class="link-danger" @click="removeRecord(r.id)">Delete</button></td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- City ESG -->
        <section v-else-if="activeTab === 'esg'" class="panel">
          <div class="esg-header">
            <div>
              <h2>City ESG Summary</h2>
              <p class="panel-sub">Aggregated environmental performance across all saved records.</p>
            </div>
            <div class="esg-export" v-if="esg.recordCount > 0">
              <button class="btn btn-sm btn-outline" @click="exportCsv">Export CSV</button>
              <button class="btn btn-sm btn-primary" :disabled="exporting" @click="exportPdf">
                {{ exporting ? 'Generating…' : 'Export PDF' }}
              </button>
            </div>
          </div>
          <div class="esg-grid">
            <div class="esg-card">
              <span>Total waste generated</span>
              <strong>{{ fmt(esg.generated) }} t</strong>
            </div>
            <div class="esg-card">
              <span>Total waste diverted</span>
              <strong>{{ fmt(esg.diverted) }} t</strong>
            </div>
            <div class="esg-card highlight">
              <span>Overall diversion rate</span>
              <strong>{{ esg.diversionRate.toFixed(1) }}%</strong>
            </div>
            <div class="esg-card highlight">
              <span>Total emissions avoided</span>
              <strong>{{ fmt(esg.avoided) }} t CO₂e</strong>
            </div>
            <div class="esg-card">
              <span>Net emissions</span>
              <strong>{{ fmt(esg.net) }} t CO₂e</strong>
            </div>
            <div class="esg-card">
              <span>Records</span>
              <strong>{{ esg.recordCount }}</strong>
            </div>
          </div>

          <div v-if="esg.recordCount > 0" class="esg-trend">
            <h3 class="trend-title">Emissions Trend by Period</h3>
            <PortfolioChart :data="trendChartData" :options="trendChartOptions" />
          </div>
          <p v-else class="muted">Save emissions records to see the city ESG summary and trend.</p>
        </section>

        <!-- Endorsements -->
        <section v-else-if="activeTab === 'endorsements'" class="panel">
          <h2>Project Host Endorsements</h2>
          <p class="panel-sub">Endorse validated community projects in your jurisdiction.</p>
          <div v-if="loadingProjects" class="muted">Loading projects…</div>
          <div v-else-if="communityProjects.length === 0" class="muted">No validated projects to review.</div>
          <div v-else class="endorse-list">
            <div v-for="p in communityProjects" :key="p.id" class="endorse-card">
              <div class="endorse-info">
                <span class="endorse-title">{{ p.title }}</span>
                <span class="endorse-meta">{{ p.category }} · {{ p.location }}</span>
                <span class="endorse-count">{{ p.endorsement_count }} endorsement(s)</span>
              </div>
              <div class="endorse-actions">
                <span v-if="p.my_endorsement" class="my-decision" :class="p.my_endorsement.decision">
                  You {{ p.my_endorsement.decision }}
                </span>
                <button class="btn btn-sm btn-primary" @click="decide(p, 'endorsed')" :disabled="busyId === p.id">
                  Endorse
                </button>
                <button class="btn btn-sm btn-outline" @click="decide(p, 'declined')" :disabled="busyId === p.id">
                  Decline
                </button>
              </div>
            </div>
          </div>
          <p v-if="endorseMessage" class="message" :class="{ error: endorseError }">{{ endorseMessage }}</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useUserStore } from '@/store/userStore'
import { computeWasteEmissions, estimateWasteFromPopulation } from '@/constants/lgu'
import {
  saveEmissionsRecord,
  getMyEmissionsRecords,
  deleteEmissionsRecord,
  buildEsgSummary,
} from '@/services/lguService'
import {
  emissionsTrendChartData,
  exportLguEsgCsv,
  exportLguEsgPdf,
} from '@/services/lguReportService'
import { getCommunityProjects, endorseProject } from '@/services/endorsementService'
import PortfolioChart from '@/components/charts/PortfolioChart.vue'

const userStore = useUserStore()

const tabs = [
  { id: 'calculator', label: 'MSW Calculator' },
  { id: 'records', label: 'Records & Diversion' },
  { id: 'esg', label: 'City ESG' },
  { id: 'endorsements', label: 'Endorsements' },
]
const activeTab = ref('calculator')

const calc = reactive({
  municipality: '',
  periodLabel: '',
  population: null,
  wasteGenerated: null,
  wasteDiverted: null,
  notes: '',
})
const saving = ref(false)
const message = ref('')
const isError = ref(false)
const suggested = ref('')

const result = computed(() => computeWasteEmissions(calc.wasteGenerated, calc.wasteDiverted))

const records = ref([])
const loadingRecords = ref(false)
const esg = computed(() => buildEsgSummary(records.value))
const exporting = ref(false)

const trendChartData = computed(() => emissionsTrendChartData(records.value))
const trendChartOptions = {
  plugins: { title: { display: false } },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { callback: (value) => `${Number(value).toLocaleString()} t` },
    },
  },
}

function reportMeta() {
  // Prefer the municipality from the most recent record; fall back to the form.
  return { municipality: records.value[0]?.municipality || calc.municipality || 'LGU' }
}

function exportCsv() {
  exportLguEsgCsv(records.value, reportMeta())
}

async function exportPdf() {
  exporting.value = true
  try {
    await exportLguEsgPdf(records.value, reportMeta())
  } catch (err) {
    console.error('LGU ESG PDF export failed:', err)
  } finally {
    exporting.value = false
  }
}

const communityProjects = ref([])
const loadingProjects = ref(false)
const busyId = ref(null)
const endorseMessage = ref('')
const endorseError = ref(false)

function fmt(n) {
  return (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}
function diversionPct(r) {
  const g = Number(r.waste_generated_tonnes) || 0
  const d = Number(r.waste_diverted_tonnes) || 0
  return g > 0 ? ((d / g) * 100).toFixed(1) : '0.0'
}
function suggestWaste() {
  suggested.value = calc.population ? estimateWasteFromPopulation(calc.population).toFixed(1) : ''
}

async function saveRecord() {
  message.value = ''
  isError.value = false
  if (!calc.wasteGenerated || calc.wasteGenerated <= 0) {
    message.value = 'Enter the waste generated (tonnes).'
    isError.value = true
    return
  }
  saving.value = true
  try {
    await saveEmissionsRecord({
      municipality: calc.municipality,
      periodLabel: calc.periodLabel,
      population: calc.population,
      wasteGenerated: calc.wasteGenerated,
      wasteDiverted: calc.wasteDiverted,
      notes: calc.notes,
    })
    message.value = 'Record saved.'
    await loadRecords()
  } catch (err) {
    message.value = err.message || 'Failed to save record'
    isError.value = true
  } finally {
    saving.value = false
  }
}

async function loadRecords() {
  loadingRecords.value = true
  try {
    records.value = await getMyEmissionsRecords(userStore.session?.user?.id)
  } catch (err) {
    console.warn('Failed to load records:', err?.message)
  } finally {
    loadingRecords.value = false
  }
}

async function removeRecord(id) {
  if (!confirm('Delete this record?')) return
  try {
    await deleteEmissionsRecord(id)
    await loadRecords()
  } catch (err) {
    alert(err.message || 'Failed to delete record')
  }
}

async function loadProjects() {
  loadingProjects.value = true
  try {
    communityProjects.value = await getCommunityProjects()
  } catch (err) {
    console.warn('Failed to load projects:', err?.message)
  } finally {
    loadingProjects.value = false
  }
}

async function decide(project, decision) {
  busyId.value = project.id
  endorseMessage.value = ''
  endorseError.value = false
  try {
    await endorseProject(project.id, decision)
    endorseMessage.value = `Project ${decision}.`
    await loadProjects()
  } catch (err) {
    endorseMessage.value = err.message || 'Failed to record endorsement'
    endorseError.value = true
  } finally {
    busyId.value = null
  }
}

// Lazy-load data when switching to a tab that needs it
watch(activeTab, (tab) => {
  if (tab === 'records' || tab === 'esg') {
    if (records.value.length === 0) loadRecords()
  }
  if (tab === 'endorsements' && communityProjects.value.length === 0) {
    loadProjects()
  }
})

loadRecords()
</script>

<style scoped>
.lgu-page {
  min-height: 100vh;
  background: var(--bg-primary, #fff);
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-header {
  background: linear-gradient(135deg, var(--primary-color, #069e2d) 0%, var(--primary-hover, #058e3f) 100%);
  color: #fff;
  padding: 2rem 0;
}

.page-title {
  font-size: 1.85rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.page-description {
  margin: 0;
  opacity: 0.95;
}

.lgu-content {
  padding: 2rem 0;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.tab {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color, #d1e7dd);
  background: #fff;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}

.tab.active {
  background: var(--primary-color, #069e2d);
  color: #fff;
  border-color: var(--primary-color, #069e2d);
}

.panel {
  background: #fff;
  border: 1px solid var(--border-color, #d1e7dd);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.panel h2 {
  margin: 0 0 0.25rem;
  font-size: 1.3rem;
}

.panel-sub {
  color: var(--text-muted, #6b7280);
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.6rem 0.85rem;
  border: 2px solid var(--border-color, #d1e7dd);
  border-radius: 0.5rem;
  font-size: 0.9rem;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary-color, #069e2d);
}

.hint {
  font-size: 0.75rem;
  color: var(--text-muted, #6b7280);
}

.results,
.esg-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.esg-export {
  display: flex;
  gap: 0.5rem;
}

.esg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.esg-trend {
  margin-top: 1rem;
}

.trend-title {
  font-size: 1rem;
  margin: 0 0 0.75rem;
}

.result-card,
.esg-card {
  background: var(--bg-secondary, #f8fdf8);
  border: 1px solid var(--border-light, #e8f5e8);
  border-radius: 0.5rem;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.result-card.highlight,
.esg-card.highlight {
  background: var(--primary-light, #e8f5e8);
}

.result-label,
.esg-card span {
  font-size: 0.78rem;
  color: var(--text-muted, #6b7280);
}

.result-card strong,
.esg-card strong {
  font-size: 1.15rem;
  color: var(--primary-color, #069e2d);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border-light, #e8f5e8);
}

.link-danger {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
  font-size: 0.8rem;
}

.muted {
  color: var(--text-muted, #6b7280);
  font-size: 0.9rem;
}

.endorse-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.endorse-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  border: 1px solid var(--border-light, #e8f5e8);
  border-radius: 0.5rem;
  padding: 0.85rem 1rem;
}

.endorse-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.endorse-title {
  font-weight: 600;
}

.endorse-meta {
  font-size: 0.8rem;
  color: var(--text-muted, #6b7280);
}

.endorse-count {
  font-size: 0.75rem;
  color: var(--primary-color, #069e2d);
}

.endorse-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.my-decision {
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: capitalize;
}

.my-decision.endorsed {
  color: #065f46;
}

.my-decision.declined {
  color: #991b1b;
}

.message {
  margin: 0.75rem 0;
  color: var(--primary-color, #069e2d);
  font-weight: 500;
}

.message.error {
  color: #dc2626;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.82rem;
}

.btn-primary {
  background: var(--primary-color, #069e2d);
  color: #fff;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--border-color, #d1e7dd);
  color: var(--text-primary, #111827);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .container { padding: 0 1rem; }
  .endorse-card { flex-direction: column; align-items: flex-start; }
}
</style>
