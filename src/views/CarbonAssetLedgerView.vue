<script setup>
import { ref, onMounted } from 'vue'
import { getMyAssetLedger } from '@/services/assetLedgerService'

const loading = ref(true)
const loadError = ref('')
const rows = ref([])
const totals = ref(null)

function peso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function num(n) {
  return Number(n || 0).toLocaleString('en-PH')
}
function statusLabel(s) {
  return String(s || '').replace(/_/g, ' ')
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const ledger = await getMyAssetLedger()
    rows.value = ledger.rows
    totals.value = ledger.totals
  } catch (err) {
    console.error('Failed to load asset ledger:', err)
    loadError.value =
      err?.message || 'We could not load your carbon assets right now. Please try again.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="asset-ledger">
    <header class="page-head">
      <h1>Carbon Asset Management</h1>
      <p>Track every credit across its lifecycle — issued, sold, retired, and on hand — per project.</p>
    </header>

    <div v-if="loading" class="muted">Loading…</div>

    <div v-else-if="loadError" class="notice error">
      <span class="material-symbols-outlined" aria-hidden="true">error</span>
      <div class="notice-body">
        <strong>Couldn't load your carbon assets.</strong>
        {{ loadError }}
        <div><button class="retry-btn" @click="load">Try again</button></div>
      </div>
    </div>

    <template v-else-if="totals && totals.projects">
      <!-- Portfolio-wide summary cards -->
      <section class="cards">
        <div class="card">
          <div class="card-label">Credits issued</div>
          <div class="card-value">{{ num(totals.issued) }}</div>
          <div class="muted small">across {{ num(totals.projects) }} project(s)</div>
        </div>
        <div class="card">
          <div class="card-label">Available inventory</div>
          <div class="card-value">{{ num(totals.inventory) }}</div>
          <div class="muted small">{{ peso(totals.inventoryValue) }} at listed price</div>
        </div>
        <div class="card">
          <div class="card-label">Credits sold</div>
          <div class="card-value">{{ num(totals.sold) }}</div>
          <div class="muted small">{{ peso(totals.soldValue) }} gross</div>
        </div>
        <div class="card">
          <div class="card-label">Credits retired</div>
          <div class="card-value">{{ num(totals.retired) }}</div>
          <div class="muted small">{{ num(totals.pending) }} pending issuance</div>
        </div>
      </section>

      <!-- Per-project asset ledger -->
      <section class="panel">
        <h2>Assets by project</h2>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th class="num">Estimated</th>
                <th class="num">Issued</th>
                <th class="num">Pending</th>
                <th class="num">Sold</th>
                <th class="num">Retired</th>
                <th class="num">Available</th>
                <th class="num">Inventory value</th>
                <th class="num">Sold value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.projectId">
                <td>
                  <router-link :to="`/projects/${row.projectId}`" class="proj-link">
                    {{ row.projectTitle }}
                  </router-link>
                </td>
                <td><span class="badge" :class="row.status">{{ statusLabel(row.status) }}</span></td>
                <td class="num">{{ num(row.estimated) }}</td>
                <td class="num">{{ num(row.issued) }}</td>
                <td class="num">{{ num(row.pending) }}</td>
                <td class="num">{{ num(row.sold) }}</td>
                <td class="num">{{ num(row.retired) }}</td>
                <td class="num">{{ num(row.inventory) }}</td>
                <td class="num">{{ peso(row.inventoryValue) }}</td>
                <td class="num">{{ peso(row.soldValue) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2"><strong>Total</strong></td>
                <td class="num"><strong>{{ num(totals.estimated) }}</strong></td>
                <td class="num"><strong>{{ num(totals.issued) }}</strong></td>
                <td class="num"><strong>{{ num(totals.pending) }}</strong></td>
                <td class="num"><strong>{{ num(totals.sold) }}</strong></td>
                <td class="num"><strong>{{ num(totals.retired) }}</strong></td>
                <td class="num"><strong>{{ num(totals.inventory) }}</strong></td>
                <td class="num"><strong>{{ peso(totals.inventoryValue) }}</strong></td>
                <td class="num"><strong>{{ peso(totals.soldValue) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="muted small legend">
          <strong>Issued</strong> = credits in your sellable pool ·
          <strong>Pending</strong> = verified reductions awaiting issuance ·
          <strong>Available</strong> = unsold inventory remaining.
        </p>
      </section>
    </template>

    <!-- Empty state: developer has no projects yet -->
    <div v-else class="empty">
      <span class="material-symbols-outlined empty-icon" aria-hidden="true">account_balance_wallet</span>
      <h2>No carbon assets yet</h2>
      <p class="muted">
        Once you submit a project and it's validated, its issued credits, sales, and retirements
        will roll up here.
      </p>
      <router-link to="/submit-project" class="btn-primary">Submit a project</router-link>
    </div>
  </div>
</template>

<style scoped>
.asset-ledger {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px;
}
.page-head h1 {
  margin: 0;
  font-size: 1.6rem;
}
.page-head p {
  color: #6b7280;
  margin: 4px 0 20px;
}
.muted {
  color: #6b7280;
}
.small {
  font-size: 0.8rem;
}
.notice {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 20px;
}
.notice.error {
  background: #fee2e2;
  color: #991b1b;
}
.retry-btn {
  margin-top: 8px;
  padding: 6px 14px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.retry-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px;
}
.card-label {
  color: #6b7280;
  font-size: 0.85rem;
}
.card-value {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 6px 0 6px;
}
.panel {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 20px;
}
.panel h2 {
  margin: 0 0 12px;
  font-size: 1.1rem;
}
.table-scroll {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th,
.data-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.9rem;
  white-space: nowrap;
}
.data-table th.num,
.data-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.data-table tfoot td {
  border-top: 2px solid #e5e7eb;
  border-bottom: none;
}
.proj-link {
  color: #069e2d;
  font-weight: 600;
  text-decoration: none;
}
.proj-link:hover {
  text-decoration: underline;
}
.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  text-transform: capitalize;
  background: #e5e7eb;
  color: #374151;
}
.badge.validated,
.badge.approved {
  background: #d1fae5;
  color: #065f46;
}
.badge.submitted,
.badge.in_review,
.badge.under_review {
  background: #dbeafe;
  color: #1e40af;
}
.badge.needs_revision {
  background: #fef3c7;
  color: #92400e;
}
.badge.rejected {
  background: #fee2e2;
  color: #991b1b;
}
.legend {
  margin: 12px 0 0;
}
.btn-primary {
  background: #069e2d;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  display: inline-block;
}
.empty {
  text-align: center;
  padding: 48px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}
.empty-icon {
  font-size: 48px;
  color: #069e2d;
}
.empty h2 {
  margin: 12px 0 6px;
  font-size: 1.2rem;
}
.empty p {
  max-width: 420px;
  margin: 0 auto 18px;
}
@media (max-width: 640px) {
  .asset-ledger {
    padding: 16px 12px;
  }
  .page-head h1 {
    font-size: 1.35rem;
  }
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
