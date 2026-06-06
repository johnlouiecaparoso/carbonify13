<template>
  <div class="user-management">
    <!-- Page Header -->
    <div class="page-header">
      <div class="container">
        <h1 class="page-title">User Management</h1>
        <p class="page-description">Manage user accounts, roles, and permissions</p>
      </div>
    </div>

    <div class="user-content">
      <div class="container">
        <!-- Search and Filters -->
        <div class="toolbar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search users by name or email..."
            class="search-input"
          />
          <select v-model="roleFilter" class="filter-select">
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="verifier">Verifier</option>
            <option value="project_developer">Project Developer</option>
            <option value="general_user">General User</option>
          </select>
        </div>

        <!-- Users Table -->
        <div v-if="loading" class="loading-state">Loading users...</div>
        <div v-else-if="error" class="error-state">{{ error }}</div>
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
                  <span class="role-badge" :class="`role-${user.role}`">
                    {{ formatRole(user.role) }}
                  </span>
                </td>
                <td>{{ user.kyc_level || 0 }}</td>
                <td>{{ formatDate(user.created_at) }}</td>
                <td>
                  <button
                    @click="openEditModal(user)"
                    class="action-btn edit-btn"
                    title="Edit User"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">edit</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Edit User Modal -->
        <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
          <div class="modal-content" @click.stop>
            <h3>Edit User</h3>
            <div v-if="selectedUser" class="form-group">
              <label>Full Name</label>
              <input v-model="selectedUser.full_name" type="text" />
            </div>
            <div v-if="selectedUser" class="form-group">
              <label>Role</label>
              <select v-model="selectedUser.role">
                <option value="general_user">General User</option>
                <option value="verifier">Verifier</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div v-if="selectedUser" class="form-group">
              <label>KYC Level</label>
              <input v-model.number="selectedUser.kyc_level" type="number" min="0" max="3" />
            </div>
            <div class="modal-actions">
              <button @click="saveUser" class="btn-primary">Save</button>
              <button @click="closeEditModal" class="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getSupabase } from '@/services/supabaseClient'

const users = ref([])
const loading = ref(true)
const error = ref('')
const searchQuery = ref('')
const roleFilter = ref('')
const showEditModal = ref(false)
const selectedUser = ref(null)

const filteredUsers = computed(() => {
  let filtered = users.value

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (user) =>
        user.full_name?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query),
    )
  }

  // Filter by role
  if (roleFilter.value) {
    filtered = filtered.filter((user) => user.role === roleFilter.value)
  }

  return filtered
})

async function loadUsers() {
  try {
    loading.value = true
    error.value = ''
    const supabase = getSupabase()

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) throw fetchError
    users.value = data || []
  } catch (err) {
    console.error('Error loading users:', err)
    error.value = 'Failed to load users. Please try again.'
  } finally {
    loading.value = false
  }
}

function formatRole(role) {
  const roleMap = {
    admin: 'Admin',
    verifier: 'Verifier',
    project_developer: 'Project Developer',
    general_user: 'General User',
  }
  return roleMap[role] || role
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function openEditModal(user) {
  selectedUser.value = { ...user }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  selectedUser.value = null
}

async function saveUser() {
  if (!selectedUser.value) return

  try {
    const supabase = getSupabase()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: selectedUser.value.full_name,
        role: selectedUser.value.role,
        kyc_level: selectedUser.value.kyc_level,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedUser.value.id)

    if (updateError) throw updateError

    // Update local users array
    const index = users.value.findIndex((u) => u.id === selectedUser.value.id)
    if (index !== -1) {
      users.value[index] = { ...selectedUser.value }
    }

    closeEditModal()
    alert('User updated successfully!')
  } catch (err) {
    console.error('Error updating user:', err)
    alert('Failed to update user. Please try again.')
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-management {
  min-height: 100vh;
  background: var(--bg-secondary, #f8fdf8);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-header {
  padding: 2rem 0;
  border-bottom: none;
  background: var(--primary-color, #10b981);
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.5rem;
}

.page-description {
  font-size: 1.1rem;
  color: #fff;
}

.user-content {
  padding: 2rem 0;
}

.toolbar {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-input,
.filter-select {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}

.search-input {
  flex: 1;
}

.filter-select {
  min-width: 150px;
}

.users-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background: #f8f9fa;
}

th,
td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

th {
  font-weight: 600;
  color: #333;
}

.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.role-admin {
  background: #fee2e2;
  color: #dc2626;
}

.role-verifier {
  background: #dbeafe;
  color: #2563eb;
}

.role-project_developer {
  background: #dcfce7;
  color: #16a34a;
}

.role-general_user {
  background: #f3f4f6;
  color: #6b7280;
}

.action-btn {
  padding: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  transition: transform 0.2s;
}

.action-btn:hover {
  transform: scale(1.2);
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

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
}

.modal-content h3 {
  margin: 0 0 1.5rem 0;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary {
  background: var(--primary-color, #10b981);
  color: white;
}

.btn-secondary {
  background: #f3f4f6;
  color: #333;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 2rem;
}
</style>
