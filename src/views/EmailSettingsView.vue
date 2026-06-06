<script setup>
import PageLayout from '@/components/layout/PageLayout.vue'
import EmailPreferences from '@/components/EmailPreferences.vue'

// This view simply wraps the EmailPreferences component
</script>

<template>
  <PageLayout>
    <div class="email-settings-view">
      <div class="page-header">
        <div class="header-content">
          <button class="btn btn-ghost back-btn" @click="$router.push('/profile')">
            <span class="back-icon">←</span>
            Back to Profile
          </button>
          <div class="header-info">
            <h1 class="page-title">Email Settings</h1>
            <p class="page-description">Manage your email notification preferences</p>
          </div>
        </div>
      </div>

      <div class="email-settings-content">
        <EmailPreferences />
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
.email-settings-view {
  min-height: 100vh;
  background: var(--ecolink-bg);
}

.page-header {
  background: var(--ecolink-surface);
  border-bottom: 1px solid var(--ecolink-border);
  padding: 2rem 0;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--ecolink-border);
  border-radius: 6px;
  color: var(--ecolink-text);
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--ecolink-bg);
  border-color: var(--ecolink-primary);
}

.back-icon {
  font-size: 1.2rem;
}

.header-info {
  flex: 1;
}

.page-title {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--ecolink-text);
}

.page-description {
  margin: 0;
  color: var(--ecolink-muted);
  font-size: 1.1rem;
}

.email-settings-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 0 1rem;
  }

  .email-settings-content {
    padding: 1rem;
  }
}
</style>








