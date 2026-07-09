<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/userStore'
import { updateProfile } from '@/services/profileService'
import { ROLES } from '@/constants/roles'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'

const userStore = useUserStore()

const editing = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref('')

const formData = ref({
  full_name: '',
  email: '',
})

const userProfile = computed(() => userStore.profile)
const userRole = computed(() => userStore.role)

const hasAvatar = computed(() => !!userProfile.value?.avatar_url)

const userInitials = computed(() => {
  const name = userProfile.value?.full_name || ''
  if (!name.trim()) return 'U'

  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const roleDisplayName = computed(() => {
  switch (userRole.value) {
    case ROLES.SUPER_ADMIN:
      return 'Super Administrator'
    case ROLES.ADMIN:
      return 'Administrator'
    case ROLES.VERIFIER:
      return 'Verifier'
    case ROLES.USER:
    default:
      return 'User'
  }
})

const roleColor = computed(() => {
  switch (userRole.value) {
    case ROLES.SUPER_ADMIN:
      return 'var(--carbonify-purple-500)'
    case ROLES.ADMIN:
      return 'var(--carbonify-red-500)'
    case ROLES.VERIFIER:
      return 'var(--carbonify-blue-500)'
    case ROLES.USER:
    default:
      return 'var(--carbonify-gray-500)'
  }
})

function startEditing() {
  editing.value = true
  formData.value = {
    full_name: userProfile.value?.full_name || '',
    email: userStore.session?.user?.email || '',
  }
  error.value = ''
  success.value = ''
}

function cancelEditing() {
  editing.value = false
  error.value = ''
  success.value = ''
}

async function saveProfile() {
  if (!userStore.session?.user?.id) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await updateProfile(userStore.session.user.id, {
      full_name: formData.value.full_name,
    })

    // Update the store
    await userStore.fetchUserProfile()

    success.value = 'Profile updated successfully'
    editing.value = false
  } catch (err) {
    error.value = 'Failed to update profile'
    console.error('Error updating profile:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (userProfile.value) {
    formData.value = {
      full_name: userProfile.value.full_name || '',
      email: userStore.session?.user?.email || '',
    }
  }
})
</script>

<template>
  <div class="user-profile">
    <div class="profile-header">
      <div class="profile-avatar">
        <div v-if="hasAvatar" class="avatar-image-wrapper">
          <img
            :src="userProfile?.avatar_url"
            :alt="userProfile?.full_name || 'User avatar'"
            class="avatar-image"
          />
        </div>
        <div v-else class="avatar-circle">
          {{ userInitials }}
        </div>
      </div>
      <div class="profile-info">
        <h2>{{ userProfile?.full_name || 'User' }}</h2>
        <div class="role-badge" :style="{ backgroundColor: roleColor }">
          {{ roleDisplayName }}
        </div>
      </div>
    </div>

    <div class="profile-content">
      <div class="profile-section">
        <h3>Profile Information</h3>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="success" class="success-message">
          {{ success }}
        </div>

        <div v-if="!editing" class="profile-details">
          <div class="detail-item">
            <span class="detail-label">Full Name</span>
            <span>{{ userProfile?.full_name || 'Not set' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Email</span>
            <span>{{ userStore.session?.user?.email || 'Not available' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Role</span>
            <span>{{ roleDisplayName }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">KYC Level</span>
            <span>{{ userProfile?.kyc_level || 0 }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Member Since</span>
            <span>{{
              userProfile?.created_at
                ? new Date(userProfile.created_at).toLocaleDateString()
                : 'Unknown'
            }}</span>
          </div>
        </div>

        <div v-else class="profile-form">
          <div class="form-group">
            <label for="full_name">Full Name</label>
            <UiInput
              id="full_name"
              v-model="formData.full_name"
              placeholder="Enter your full name"
            />
          </div>

          <div class="form-group">
            <label for="email">Email</label>
            <UiInput
              id="email"
              v-model="formData.email"
              disabled
              placeholder="Email cannot be changed"
            />
            <small class="form-help">Email cannot be changed. Contact support if needed.</small>
          </div>

          <div class="form-actions">
            <UiButton variant="outline" @click="cancelEditing"> Cancel </UiButton>
            <UiButton @click="saveProfile" :disabled="loading || !formData.full_name.trim()">
              {{ loading ? 'Saving...' : 'Save Changes' }}
            </UiButton>
          </div>
        </div>

        <div v-if="!editing" class="profile-actions">
          <UiButton @click="startEditing"> Edit Profile </UiButton>
        </div>
      </div>

      <div class="profile-section">
        <h3>Account Security</h3>
        <div class="security-info">
          <div class="security-item">
            <span class="security-label">Password</span>
            <span class="security-status">••••••••</span>
            <UiButton size="small" variant="outline"> Change Password </UiButton>
          </div>
          <div class="security-item">
            <span class="security-label">Two-Factor Authentication</span>
            <span class="security-status">Not enabled</span>
            <UiButton size="small" variant="outline"> Enable 2FA </UiButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-profile {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--carbonify-surface);
  border-radius: var(--radius);
  border: 1px solid var(--carbonify-border);
}

.profile-avatar {
  flex-shrink: 0;
}

.avatar-circle,
.avatar-image-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-circle {
  background: var(--carbonify-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  font-size: 32px;
  font-weight: 700;
}

.profile-info h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--carbonify-text);
}

.role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.profile-section {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
  padding: 24px;
}

.profile-section h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.error-message {
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
  padding: 12px;
  border-radius: var(--radius);
  margin-bottom: 16px;
}

.success-message {
  background: var(--carbonify-success-bg);
  color: var(--carbonify-success);
  padding: 12px;
  border-radius: var(--radius);
  margin-bottom: 16px;
}

.profile-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item label,
.detail-item .detail-label {
  font-weight: 500;
  color: var(--carbonify-muted);
  font-size: 14px;
}

.detail-item span {
  color: var(--carbonify-text);
  font-size: 16px;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 500;
  color: var(--carbonify-text);
}

.form-help {
  color: var(--carbonify-muted);
  font-size: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.profile-actions {
  display: flex;
  gap: 12px;
}

.security-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.security-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--carbonify-bg);
  border-radius: var(--radius);
}

.security-label {
  flex: 1;
  font-weight: 500;
  color: var(--carbonify-text);
}

.security-status {
  color: var(--carbonify-muted);
  font-family: monospace;
}
</style>
