<script setup>
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import AdminDashboard from '@/components/admin/AdminDashboard.vue'

const router = useRouter()
const userStore = useUserStore()
</script>

<template>
  <div class="module-page">
    <header class="module-header">
      <button class="btn btn-ghost" @click="router.push('/dashboard')">← Back to Dashboard</button>
      <h1 class="module-title">Admin Panel</h1>
      <p class="module-subtitle">System administration and configuration</p>
    </header>

    <main class="module-content">
      <AdminDashboard />
    </main>
  </div>
</template>

<style scoped>
.module-page {
  min-height: 100vh;
  background: var(--carbonify-bg);
}

.module-header {
  background: var(--carbonify-surface);
  border-bottom: 1px solid var(--carbonify-border);
  padding: 24px;
}

.module-title {
  margin: 16px 0 8px 0;
  font-size: 32px;
  font-weight: 800;
  color: var(--carbonify-text);
}

.module-subtitle {
  margin: 0;
  font-size: 16px;
  color: var(--carbonify-muted);
}

.module-content {
  padding: 40px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.placeholder-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
  padding: 48px;
  text-align: center;
  box-shadow: var(--shadow-md);
}

.placeholder-icon {
  font-size: 64px;
  margin-bottom: 24px;
}

.placeholder-card h2 {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--carbonify-text);
}

.placeholder-card p {
  margin: 0 0 16px 0;
  color: var(--carbonify-muted);
}

.placeholder-card ul {
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
  color: var(--carbonify-muted);
}

.placeholder-card li {
  margin-bottom: 8px;
}
</style>
