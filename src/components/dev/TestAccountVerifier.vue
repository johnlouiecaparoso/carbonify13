<template>
  <div class="test-verifier">
    <div class="verifier-header">
      <h3>
        <span class="material-symbols-outlined" aria-hidden="true">science</span>
        Test Account Verifier
      </h3>
      <p>Verify that your Supabase test accounts are set up correctly</p>
    </div>

    <div class="verifier-actions">
      <button @click="verifyAccounts" :disabled="loading" class="verify-btn">
        {{ loading ? 'Verifying...' : 'Verify Test Accounts' }}
      </button>
      <button @click="testLogins" :disabled="loading" class="test-btn">
        {{ loading ? 'Testing...' : 'Test Logins' }}
      </button>
    </div>

    <div v-if="results.length > 0" class="results">
      <h4>Results:</h4>
      <div class="result-list">
        <div v-for="(result, index) in results" :key="index" :class="['result-item', result.type]">
          <span class="result-icon material-symbols-outlined" aria-hidden="true">{{ result.icon }}</span>
          <span class="result-message">{{ result.message }}</span>
        </div>
      </div>
    </div>

    <div class="account-info">
      <h4>Expected Test Accounts:</h4>
      <div class="account-list">
        <div class="account-item">
          <span class="account-role">
            <span class="material-symbols-outlined" aria-hidden="true">crown</span>
            Admin
          </span>
          <span class="account-email">admin@carbonify.test</span>
          <span class="account-password">admin123</span>
        </div>
        <div class="account-item">
          <span class="account-role">
            <span class="material-symbols-outlined" aria-hidden="true">verified_user</span>
            Verifier
          </span>
          <span class="account-email">verifier@carbonify.test</span>
          <span class="account-password">verifier123</span>
        </div>
        <div class="account-item">
          <span class="account-role">
            <span class="material-symbols-outlined" aria-hidden="true">person</span>
            User
          </span>
          <span class="account-email">user@carbonify.test</span>
          <span class="account-password">user123</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { verifyTestAccounts, testAccountLogins } from '@/utils/verifyTestAccounts'

const loading = ref(false)
const results = ref([])

function addResult(type, icon, message) {
  results.value.push({ type, icon, message })
}

function clearResults() {
  results.value = []
}

async function verifyAccounts() {
  loading.value = true
  clearResults()

  try {
    addResult('info', 'search', 'Starting verification...')
    const success = await verifyTestAccounts()

    if (success) {
      addResult('success', 'check_circle', 'All test accounts verified successfully!')
    } else {
      addResult('error', 'error', 'Some test accounts are missing or misconfigured')
      addResult('info', 'description', 'Please run the SQL setup script in Supabase')
    }
  } catch (error) {
    addResult('error', 'error', `Verification failed: ${error.message}`)
  } finally {
    loading.value = false
  }
}

async function testLogins() {
  loading.value = true
  clearResults()

  try {
    addResult('info', 'lock', 'Testing login functionality...')
    await testAccountLogins()
    addResult('success', 'task_alt', 'Login testing completed - check console for details')
  } catch (error) {
    addResult('error', 'error', `Login testing failed: ${error.message}`)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.test-verifier {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
}

.verifier-header {
  text-align: center;
  margin-bottom: 2rem;
}

.verifier-header h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.verifier-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.verifier-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.verify-btn,
.test-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.verify-btn {
  background: var(--primary-color);
  color: white;
}

.verify-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.test-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.test-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.verify-btn:disabled,
.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.results {
  margin-bottom: 2rem;
}

.results h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
}

.result-item.success {
  background: var(--success-light);
  color: var(--success-color);
}

.result-item.error {
  background: var(--error-light);
  color: var(--error-color);
}

.result-item.info {
  background: var(--info-light);
  color: var(--info-color);
}

.account-info h4 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.account-item {
  display: grid;
  grid-template-columns: 100px 200px 1fr;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
}

.account-role {
  font-weight: 600;
  color: var(--text-primary);
}

.account-email {
  color: var(--primary-color);
  font-family: monospace;
}

.account-password {
  color: var(--text-secondary);
  font-family: monospace;
}

@media (max-width: 640px) {
  .test-verifier {
    margin: 1rem;
    padding: 1rem;
  }

  .verifier-actions {
    flex-direction: column;
  }

  .account-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}
</style>
