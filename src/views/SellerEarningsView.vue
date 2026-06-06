<script setup>
import { ref, computed, onMounted } from 'vue'
import { getSellerBalance, getMySales, getMyPayouts } from '@/services/payoutService'
import { getMyKyb } from '@/services/kybService'
import Withdraw from '@/components/wallet/Withdraw.vue'

const loading = ref(true)
const balance = ref({ available: 0, held: 0, currency: 'PHP' })
const sales = ref([])
const payouts = ref([])
const kyb = ref({ verified: false, application: null })
const showWithdraw = ref(false)

const totalEarned = computed(() =>
  sales.value
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
)
const creditsSold = computed(() =>
  sales.value
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + Number(s.quantity || 0), 0),
)

function peso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function shortDate(d) {
  return d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
}

async function load() {
  loading.value = true
  try {
    const [b, s, p, k] = await Promise.all([
      getSellerBalance(),
      getMySales(),
      getMyPayouts(),
      getMyKyb(),
    ])
    balance.value = b
    sales.value = s
    payouts.value = p
    kyb.value = k
  } finally {
    loading.value = false
  }
}

function onWithdrawSuccess() {
  showWithdraw.value = false
  load()
}

onMounted(load)
</script>

<template>
  <div class="seller-earnings">
    <header class="page-head">
      <h1>Seller Earnings</h1>
      <p>Your sales, balance, and withdrawals.</p>
    </header>

    <div v-if="loading" class="muted">Loading…</div>

    <template v-else>
      <!-- KYB gate notice -->
      <div v-if="!kyb.verified" class="notice warn">
        <span class="material-symbols-outlined" aria-hidden="true">verified_user</span>
        <div>
          <strong>Business verification required.</strong>
          You must complete KYB before withdrawing earnings.
          <template v-if="kyb.application"> Current status: {{ kyb.application.status }}.</template>
        </div>
      </div>

      <!-- Balance cards -->
      <section class="cards">
        <div class="card">
          <div class="card-label">Available to withdraw</div>
          <div class="card-value">{{ peso(balance.available) }}</div>
          <button
            class="btn-primary"
            :disabled="!kyb.verified || balance.available <= 0"
            @click="showWithdraw = true"
          >
            Withdraw
          </button>
        </div>
        <div class="card">
          <div class="card-label">Held in escrow</div>
          <div class="card-value">{{ peso(balance.held) }}</div>
          <div class="muted small">Released after the hold period</div>
        </div>
        <div class="card">
          <div class="card-label">Total earned</div>
          <div class="card-value">{{ peso(totalEarned) }}</div>
          <div class="muted small">{{ creditsSold }} credits sold</div>
        </div>
      </section>

      <!-- Withdraw modal -->
      <div v-if="showWithdraw" class="modal-overlay" @click.self="showWithdraw = false">
        <div class="modal">
          <Withdraw @success="onWithdrawSuccess" @cancel="showWithdraw = false" />
        </div>
      </div>

      <!-- Recent sales -->
      <section class="panel">
        <h2>Recent sales</h2>
        <table v-if="sales.length" class="data-table">
          <thead>
            <tr><th>Date</th><th>Credits</th><th>Unit</th><th>Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in sales" :key="s.id">
              <td>{{ shortDate(s.created_at) }}</td>
              <td>{{ s.quantity }}</td>
              <td>{{ peso(s.price_per_credit) }}</td>
              <td>{{ peso(s.total_amount) }}</td>
              <td><span class="badge" :class="s.status">{{ s.status }}</span></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">No sales yet.</p>
      </section>

      <!-- Payout history -->
      <section class="panel">
        <h2>Withdrawals</h2>
        <table v-if="payouts.length" class="data-table">
          <thead>
            <tr><th>Date</th><th>Amount</th><th>Status</th><th>Note</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in payouts" :key="p.id">
              <td>{{ shortDate(p.created_at) }}</td>
              <td>{{ peso(p.amount) }}</td>
              <td><span class="badge" :class="p.status">{{ p.status }}</span></td>
              <td class="muted small">{{ p.failure_reason || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted">No withdrawals yet.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.seller-earnings {
  max-width: 960px;
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
.notice.warn {
  background: #fef3c7;
  color: #92400e;
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
  margin: 6px 0 12px;
}
.btn-primary {
  background: #10b981;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
}
.badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  text-transform: capitalize;
  background: #e5e7eb;
}
.badge.completed,
.badge.settled {
  background: #d1fae5;
  color: #065f46;
}
.badge.failed,
.badge.refunded {
  background: #fee2e2;
  color: #991b1b;
}
.badge.requested,
.badge.processing {
  background: #dbeafe;
  color: #1e40af;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  max-width: 540px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}
</style>
