<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/store/userStore'
import { roleService } from '@/services/roleService'
import { ROLES } from '@/constants/roles'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'

const userStore = useUserStore()

const users = ref([])
const loading = ref(false)
const error = ref('')
const searchTerm = ref('')
const selectedUser = ref(null)
const newRole = ref('')
const showRoleModal = ref(false)

const filteredUsers = computed(() => {
  if (!searchTerm.value) return users.value
  return users.value.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.value.toLowerCase()),
  )
})

const roleOptions = computed(() => {
  const options = [
    { value: ROLES.USER, label: 'User' },
    { value: ROLES.VERIFIER, label: 'Verifier' },
    { value: ROLES.ADMIN, label: 'Admin' },
  ]

  // All admins can assign any role

  return options
})

async function loadUsers() {
  loading.value = true
  error.value = ''

  try {
    users.value = await roleService.getAllUsersWithRoles()
  } catch (err) {
    error.value = 'Failed to load users'
    console.error('Error loading users:', err)
  } finally {
    loading.value = false
  }
}

function openRoleModal(user) {
  selectedUser.value = user
  newRole.value = user.role
  showRoleModal.value = true
}

async function updateUserRole() {
  if (!selectedUser.value || !newRole.value) return

  loading.value = true
  error.value = ''

  try {
    const success = await roleService.updateUserRole(selectedUser.value.id, newRole.value)
    if (success) {
      // Update local state
      const userIndex = users.value.findIndex((u) => u.id === selectedUser.value.id)
      if (userIndex !== -1) {
        users.value[userIndex].role = newRole.value
      }
      showRoleModal.value = false
    } else {
      error.value = 'Failed to update user role'
    }
  } catch (err) {
    error.value = 'Failed to update user role'
    console.error('Error updating user role:', err)
  } finally {
    loading.value = false
  }
}

function canAssignRole(targetRole) {
  return roleService.canAssignRole(userStore.role, targetRole)
}

function getRoleBadgeClass(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'badge-super-admin'
    case ROLES.ADMIN:
      return 'badge-admin'
    case ROLES.VERIFIER:
      return 'badge-verifier'
    case ROLES.USER:
    default:
      return 'badge-user'
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="role-management">
    <div class="header">
      <h2>User Role Management</h2>
      <p>Manage user roles and permissions</p>
    </div>

    <div class="controls">
      <UiInput v-model="searchTerm" placeholder="Search users..." class="search-input" />
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="loading" class="loading">Loading users...</div>

    <div v-else class="users-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>KYC Level</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.full_name || 'N/A' }}</td>
            <td>{{ user.email || 'N/A' }}</td>
            <td>
              <span :class="['role-badge', getRoleBadgeClass(user.role)]">
                {{ user.role }}
              </span>
            </td>
            <td>{{ user.kyc_level || 0 }}</td>
            <td>{{ new Date(user.created_at).toLocaleDateString() }}</td>
            <td>
              <UiButton
                size="small"
                variant="outline"
                @click="openRoleModal(user)"
                :disabled="!canAssignRole(user.role)"
              >
                Change Role
              </UiButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Role Change Modal -->
    <div v-if="showRoleModal" class="modal-overlay" @click="showRoleModal = false">
      <div class="modal" @click.stop>
        <h3>Change User Role</h3>
        <p>User: {{ selectedUser?.full_name }}</p>

        <div class="form-group">
          <label>New Role:</label>
          <select v-model="newRole" class="role-select">
            <option
              v-for="option in roleOptions"
              :key="option.value"
              :value="option.value"
              :disabled="!canAssignRole(option.value)"
            >
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="modal-actions">
          <UiButton variant="outline" @click="showRoleModal = false"> Cancel </UiButton>
          <UiButton @click="updateUserRole" :disabled="loading || newRole === selectedUser?.role">
            Update Role
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-management {
  padding: 24px;
}

.header {
  margin-bottom: 24px;
}

.header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--carbonify-text);
}

.header p {
  margin: 0;
  color: var(--carbonify-muted);
}

.controls {
  margin-bottom: 24px;
}

.search-input {
  max-width: 300px;
}

.error-message {
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
  padding: 12px;
  border-radius: var(--radius);
  margin-bottom: 16px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--carbonify-muted);
}

.users-table {
  background: var(--carbonify-surface);
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--carbonify-border);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--carbonify-border);
}

th {
  background: var(--carbonify-bg);
  font-weight: 600;
  color: var(--carbonify-text);
}

td {
  color: var(--carbonify-text);
}

.role-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-super-admin {
  background: var(--carbonify-purple-100);
  color: var(--carbonify-purple-700);
}

.badge-admin {
  background: var(--carbonify-red-100);
  color: var(--carbonify-red-700);
}

.badge-verifier {
  background: var(--carbonify-blue-100);
  color: var(--carbonify-blue-700);
}

.badge-user {
  background: var(--carbonify-gray-100);
  color: var(--carbonify-gray-700);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--carbonify-surface);
  border-radius: var(--radius);
  padding: 24px;
  min-width: 400px;
  max-width: 500px;
}

.modal h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--carbonify-text);
}

.role-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
  background: var(--carbonify-bg);
  color: var(--carbonify-text);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
