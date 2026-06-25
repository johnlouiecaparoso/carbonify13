<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/store/userStore'
import { getUserEmailPreferences, updateUserEmailPreferences } from '@/services/emailService'
import UiButton from '@/components/ui/Button.vue'

const userStore = useUserStore()

// State
const preferences = ref({
  project_updates: true,
  credit_purchases: true,
  system_notifications: true,
  marketing_emails: false,
})
const notificationFrequency = ref('immediate')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

// Load user preferences
async function loadPreferences() {
  try {
    loading.value = true
    error.value = ''

    const userPrefs = await getUserEmailPreferences(userStore.user?.id)
    preferences.value = userPrefs
  } catch (err) {
    console.error('Error loading email preferences:', err)
    error.value = 'Failed to load email preferences'
  } finally {
    loading.value = false
  }
}

// Save user preferences
async function savePreferences() {
  try {
    saving.value = true
    error.value = ''
    success.value = ''

    await updateUserEmailPreferences(userStore.user?.id, preferences.value)
    success.value = 'Email preferences updated successfully!'

    // Clear success message after 3 seconds
    setTimeout(() => {
      success.value = ''
    }, 3000)
  } catch (err) {
    console.error('Error saving email preferences:', err)
    error.value = 'Failed to save email preferences'
  } finally {
    saving.value = false
  }
}

// Reset to defaults
function resetToDefaults() {
  preferences.value = {
    project_updates: true,
    credit_purchases: true,
    system_notifications: true,
    marketing_emails: false,
  }
  notificationFrequency.value = 'immediate'
}

onMounted(() => {
  loadPreferences()
})
</script>

<template>
  <div class="email-preferences">
    <div class="preferences-header">
      <h2>Email Notification Preferences</h2>
      <p>Choose which email notifications you'd like to receive from Carbonify.</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading your preferences...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon"><span class="material-symbols-outlined" aria-hidden="true">warning</span></div>
      <h3>Failed to Load Preferences</h3>
      <p>{{ error }}</p>
      <UiButton @click="loadPreferences">Retry</UiButton>
    </div>

    <!-- Preferences Form -->
    <div v-else class="preferences-form">
      <!-- Success Message -->
      <div v-if="success" class="success-message">
        <div class="success-icon"><span class="material-symbols-outlined" aria-hidden="true">check_circle</span></div>
        <p>{{ success }}</p>
      </div>

      <!-- Notification Types -->
      <div class="preferences-section">
        <h3>Notification Types</h3>
        <p class="section-description">
          Select which types of notifications you want to receive via email.
        </p>

        <div class="preference-items">
          <div class="preference-item">
            <div class="preference-info">
              <h4>Project Updates</h4>
              <p>Get notified when your projects are approved, rejected, or need attention.</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="preferences.project_updates" :disabled="saving" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="preference-item">
            <div class="preference-info">
              <h4>Credit Purchases</h4>
              <p>Receive confirmation emails when you purchase carbon credits.</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="preferences.credit_purchases" :disabled="saving" />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="preference-item">
            <div class="preference-info">
              <h4>System Notifications</h4>
              <p>Important platform updates, security alerts, and account changes.</p>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                v-model="preferences.system_notifications"
                :disabled="saving"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="preference-item">
            <div class="preference-info">
              <h4>Marketing Emails</h4>
              <p>Newsletters, tips, and promotional content about environmental impact.</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="preferences.marketing_emails" :disabled="saving" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Notification Frequency -->
      <div class="preferences-section">
        <h3>Notification Frequency</h3>
        <p class="section-description">Choose how often you want to receive digest emails.</p>

        <div class="frequency-options">
          <label class="frequency-option">
            <input
              type="radio"
              v-model="notificationFrequency"
              value="immediate"
              :disabled="saving"
            />
            <span class="radio-label">
              <strong>Immediate</strong>
              <small>Get notifications as they happen</small>
            </span>
          </label>

          <label class="frequency-option">
            <input type="radio" v-model="notificationFrequency" value="daily" :disabled="saving" />
            <span class="radio-label">
              <strong>Daily Digest</strong>
              <small>One email per day with all updates</small>
            </span>
          </label>

          <label class="frequency-option">
            <input type="radio" v-model="notificationFrequency" value="weekly" :disabled="saving" />
            <span class="radio-label">
              <strong>Weekly Digest</strong>
              <small>One email per week with all updates</small>
            </span>
          </label>

          <label class="frequency-option">
            <input type="radio" v-model="notificationFrequency" value="never" :disabled="saving" />
            <span class="radio-label">
              <strong>Never</strong>
              <small>No digest emails (individual notifications still sent)</small>
            </span>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="preferences-actions">
        <UiButton variant="outline" @click="resetToDefaults" :disabled="saving">
          Reset to Defaults
        </UiButton>

        <UiButton variant="primary" @click="savePreferences" :disabled="saving">
          <span v-if="saving">Saving...</span>
          <span v-else>Save Preferences</span>
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.email-preferences {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.preferences-header {
  margin-bottom: 2rem;
  text-align: center;
}

.preferences-header h2 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--carbonify-text);
}

.preferences-header p {
  margin: 0;
  color: var(--carbonify-muted);
  font-size: 1.1rem;
}

/* Loading and Error States */
.loading-state,
.error-state {
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* Success Message */
.success-message {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--carbonify-success-bg);
  color: var(--carbonify-success);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.success-icon {
  font-size: 20px;
}

/* Preferences Form */
.preferences-form {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: 12px;
  padding: 24px;
}

.preferences-section {
  margin-bottom: 32px;
}

.preferences-section:last-of-type {
  margin-bottom: 24px;
}

.preferences-section h3 {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.section-description {
  margin: 0 0 20px 0;
  color: var(--carbonify-muted);
  font-size: 0.9rem;
}

/* Preference Items */
.preference-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preference-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: 8px;
}

.preference-info h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.preference-info p {
  margin: 0;
  color: var(--carbonify-muted);
  font-size: 0.875rem;
  line-height: 1.4;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--carbonify-border);
  transition: 0.2s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--carbonify-primary);
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Frequency Options */
.frequency-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.frequency-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.frequency-option:hover {
  background: var(--carbonify-primary-50);
  border-color: var(--carbonify-primary);
}

.frequency-option input[type='radio'] {
  margin: 0;
}

.radio-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.radio-label strong {
  color: var(--carbonify-text);
  font-size: 0.9rem;
}

.radio-label small {
  color: var(--carbonify-muted);
  font-size: 0.8rem;
}

/* Action Buttons */
.preferences-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 24px;
  border-top: 1px solid var(--carbonify-border);
}

/* Responsive Design */
@media (max-width: 768px) {
  .email-preferences {
    padding: 1rem;
  }

  .preference-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .preferences-actions {
    flex-direction: column;
  }

  .frequency-option {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>








