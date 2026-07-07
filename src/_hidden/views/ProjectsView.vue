<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { projectService } from '@/services/projectService'
import ProjectForm from '@/components/ProjectForm.vue'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'

const router = useRouter()
const userStore = useUserStore()

// State
const projects = ref([])
const loading = ref(false)
const error = ref('')
const searchTerm = ref('')
const statusFilter = ref('')
const categoryFilter = ref('')
const showProjectForm = ref(false)
const editingProject = ref(null)
const selectedProject = ref(null)
const showProjectModal = ref(false)

// Computed properties
const filteredProjects = computed(() => {
  let filtered = projects.value

  // Filter by search term
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    filtered = filtered.filter(
      (project) =>
        project.title.toLowerCase().includes(term) ||
        project.description.toLowerCase().includes(term) ||
        project.location.toLowerCase().includes(term),
    )
  }

  // Filter by status
  if (statusFilter.value) {
    filtered = filtered.filter((project) => project.status === statusFilter.value)
  }

  // Filter by category
  if (categoryFilter.value) {
    filtered = filtered.filter((project) => project.category === categoryFilter.value)
  }

  return filtered
})

const statusOptions = computed(() => {
  const statuses = projectService.getProjectStatuses()
  return [{ value: '', label: 'All Statuses' }, ...statuses]
})

const categoryOptions = computed(() => {
  const categories = projectService.getProjectCategories()
  return [
    { value: '', label: 'All Categories' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ]
})

const projectStats = computed(() => {
  const stats = {
    total: projects.value.length,
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
  }

  projects.value.forEach((project) => {
    if (stats.hasOwnProperty(project.status)) {
      stats[project.status]++
    }
  })

  return stats
})

// Methods
async function loadProjects() {
  loading.value = true
  error.value = ''

  try {
    projects.value = await projectService.getUserProjects()
  } catch (err) {
    error.value = 'Failed to load projects'
    console.error('Error loading projects:', err)
  } finally {
    loading.value = false
  }
}

function openProjectForm(project = null) {
  editingProject.value = project
  showProjectForm.value = true
}

function closeProjectForm() {
  showProjectForm.value = false
  editingProject.value = null
}

function openProjectModal(project) {
  selectedProject.value = project
  showProjectModal.value = true
}

function closeProjectModal() {
  showProjectModal.value = false
  selectedProject.value = null
}

async function handleProjectSuccess() {
  await loadProjects()
  closeProjectForm()
}

async function deleteProject(project) {
  if (
    !confirm(`Are you sure you want to delete "${project.title}"? This action cannot be undone.`)
  ) {
    return
  }

  try {
    await projectService.deleteProject(project.id)
    await loadProjects()
  } catch (err) {
    error.value = 'Failed to delete project'
    console.error('Error deleting project:', err)
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'pending':
      return 'badge-pending'
    case 'under_review':
      return 'badge-under-review'
    case 'approved':
      return 'badge-approved'
    case 'rejected':
      return 'badge-rejected'
    default:
      return 'badge-default'
  }
}

function getStatusLabel(status) {
  const statusMap = {
    pending: 'Pending',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return statusMap[status] || status
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function clearFilters() {
  searchTerm.value = ''
  statusFilter.value = ''
  categoryFilter.value = ''
}

// Lifecycle
onMounted(() => {
  loadProjects()
})
</script>

<template>
  <div class="projects-view">
    <div class="page-header">
      <div class="header-content">
        <h1>My Projects</h1>
        <p>Manage your environmental projects and track their status</p>
      </div>
      <UiButton @click="openProjectForm()" class="create-btn"> + Create New Project </UiButton>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Project Statistics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">{{ projectStats.total }}</div>
        <div class="stat-label">Total Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ projectStats.pending }}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ projectStats.under_review }}</div>
        <div class="stat-label">Under Review</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ projectStats.approved }}</div>
        <div class="stat-label">Approved</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filters">
        <UiInput
          v-model="searchTerm"
          placeholder="Search by title, description, or location..."
          class="search-input"
        />
        <select v-model="statusFilter" class="filter-select">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select v-model="categoryFilter" class="filter-select">
          <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <UiButton variant="outline" @click="clearFilters" size="small"> Clear Filters </UiButton>
      </div>
    </div>

    <!-- Search Results Info -->
    <div v-if="searchTerm || statusFilter || categoryFilter" class="search-results-info">
      <p class="results-text">
        <span class="results-count">{{ filteredProjects.length }}</span>
        {{ filteredProjects.length === 1 ? 'project' : 'projects' }} found
        <span v-if="searchTerm" class="search-term">for "{{ searchTerm }}"</span>
      </p>
    </div>

    <!-- Projects List -->
    <div class="projects-section">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading your projects...</p>
      </div>

      <div v-else-if="filteredProjects.length === 0" class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>No Projects Found</h3>
        <p v-if="projects.length === 0">
          You haven't created any projects yet. Start by creating your first environmental project!
        </p>
        <p v-else>No projects match your current filters. Try adjusting your search criteria.</p>
        <UiButton @click="openProjectForm()" v-if="projects.length === 0">
          Create Your First Project
        </UiButton>
      </div>

      <div v-else class="projects-grid">
        <div
          v-for="project in filteredProjects"
          :key="project.id"
          class="project-card"
          @click="openProjectModal(project)"
        >
          <div class="project-header">
            <h3 class="project-title">{{ project.title }}</h3>
            <span :class="['status-badge', getStatusBadgeClass(project.status)]">
              {{ getStatusLabel(project.status) }}
            </span>
          </div>

          <div class="project-meta">
            <span class="project-category">{{ project.category }}</span>
            <span class="project-location">
              <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
              <span>{{ project.location }}</span>
            </span>
          </div>

          <p class="project-description">
            {{ project.description.substring(0, 150)
            }}{{ project.description.length > 150 ? '...' : '' }}
          </p>

          <div class="project-footer">
            <span class="project-date">Created {{ formatDate(project.created_at) }}</span>
            <div class="project-actions" @click.stop>
              <UiButton
                size="small"
                variant="outline"
                @click="openProjectForm(project)"
                :disabled="project.status !== 'pending'"
              >
                Edit
              </UiButton>
              <UiButton
                size="small"
                variant="outline"
                @click="deleteProject(project)"
                :disabled="project.status !== 'pending'"
                class="delete-btn"
              >
                Delete
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Project Form Modal -->
    <div v-if="showProjectForm" class="modal-overlay" @click="closeProjectForm">
      <div class="modal" @click.stop>
        <ProjectForm
          :project="editingProject"
          :mode="editingProject ? 'edit' : 'create'"
          @success="handleProjectSuccess"
          @cancel="closeProjectForm"
        />
      </div>
    </div>

    <!-- Project Detail Modal -->
    <div v-if="showProjectModal" class="modal-overlay" @click="closeProjectModal">
      <div class="modal project-detail-modal" @click.stop>
        <div class="modal-header">
          <h2>{{ selectedProject?.title }}</h2>
          <button class="close-btn" @click="closeProjectModal">×</button>
        </div>

        <div class="modal-content">
          <div class="project-detail-meta">
            <div class="meta-item">
              <strong>Status:</strong>
              <span :class="['status-badge', getStatusBadgeClass(selectedProject?.status)]">
                {{ getStatusLabel(selectedProject?.status) }}
              </span>
            </div>
            <div class="meta-item">
              <strong>Category:</strong>
              <span>{{ selectedProject?.category }}</span>
            </div>
            <div class="meta-item">
              <strong>Location:</strong>
              <span>
                <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
                <span>{{ selectedProject?.location }}</span>
              </span>
            </div>
            <div class="meta-item">
              <strong>Created:</strong>
              <span>{{ formatDate(selectedProject?.created_at) }}</span>
            </div>
          </div>

          <div class="project-detail-section">
            <h3>Description</h3>
            <p>{{ selectedProject?.description }}</p>
          </div>

          <div class="project-detail-section">
            <h3>Expected Impact</h3>
            <p>{{ selectedProject?.expected_impact }}</p>
          </div>

          <div v-if="selectedProject?.verification_notes" class="project-detail-section">
            <h3>Verification Notes</h3>
            <p>{{ selectedProject.verification_notes }}</p>
          </div>
        </div>

        <div class="modal-actions">
          <UiButton variant="outline" @click="closeProjectModal"> Close </UiButton>
          <UiButton
            @click="openProjectForm(selectedProject)"
            :disabled="selectedProject?.status !== 'pending'"
          >
            Edit Project
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.projects-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  gap: 24px;
}

.header-content h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 800;
  color: var(--carbonify-text);
}

.header-content p {
  margin: 0;
  color: var(--carbonify-muted);
  font-size: 16px;
}

.create-btn {
  flex-shrink: 0;
}

.error-message {
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
  padding: 12px 16px;
  border-radius: var(--radius);
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
  padding: 20px;
  text-align: center;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--carbonify-text);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: var(--carbonify-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filters-section {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  margin-bottom: 32px;
  box-shadow: none;
}

.filters {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 250px;
  position: relative;
}

.search-input input {
  padding-left: 48px !important;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23069e2d'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'/%3e%3c/svg%3e");
  background-position: left 16px center;
  background-repeat: no-repeat;
  background-size: 20px;
}

.filter-select {
  padding: 16px 24px;
  border: 2px solid var(--primary-color, #069e2d);
  border-radius: var(--radius-xl, 1rem);
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #1a202c);
  font-size: 16px;
  font-weight: 500;
  min-width: 200px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-green, 0 4px 12px rgba(6, 158, 45, 0.15));
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23069e2d' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 12px center;
  background-repeat: no-repeat;
  background-size: 16px;
  padding-right: 48px;
}

.filter-select:hover {
  border-color: var(--primary-hover, #058e3f);
  box-shadow: var(--shadow-green-lg, 0 8px 20px rgba(6, 158, 45, 0.3));
  transform: translateY(-2px);
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary-hover, #058e3f);
  box-shadow:
    0 0 0 4px var(--primary-light, rgba(6, 158, 45, 0.2)),
    var(--shadow-green-lg, 0 8px 20px rgba(6, 158, 45, 0.3));
  transform: translateY(-2px);
}

/* Search Results Info */
.search-results-info {
  margin-bottom: 24px;
  padding: 12px 20px;
  background: var(--bg-secondary, #f8fdf8);
  border-radius: var(--radius-lg, 0.75rem);
  border-left: 4px solid var(--primary-color, #069e2d);
}

.results-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary, #4a5568);
  font-weight: 500;
}

.results-count {
  font-weight: 700;
  color: var(--primary-color, #069e2d);
  font-size: 16px;
}

.search-term {
  font-style: italic;
  color: var(--text-primary, #1a202c);
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--carbonify-muted);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--carbonify-border);
  border-top: 3px solid var(--carbonify-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--carbonify-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
}

.project-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: var(--radius);
  padding: 24px;
  cursor: pointer;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: var(--carbonify-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  gap: 12px;
}

.project-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--carbonify-text);
  flex: 1;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.badge-pending {
  background: var(--carbonify-yellow-100);
  color: var(--carbonify-yellow-700);
}

.badge-under-review {
  background: var(--carbonify-blue-100);
  color: var(--carbonify-blue-700);
}

.badge-approved {
  background: var(--carbonify-green-100);
  color: var(--carbonify-green-700);
}

.badge-rejected {
  background: var(--carbonify-red-100);
  color: var(--carbonify-red-700);
}

.project-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--carbonify-muted);
}

.project-category {
  font-weight: 500;
  color: var(--carbonify-text);
}

.project-location {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.project-location .material-symbols-outlined {
  font-size: 1rem;
}

.project-description {
  margin: 0 0 16px 0;
  color: var(--carbonify-text);
  line-height: 1.5;
}

.project-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid var(--carbonify-border);
}

.project-date {
  font-size: 12px;
  color: var(--carbonify-muted);
}

.project-actions {
  display: flex;
  gap: 8px;
}

.delete-btn {
  color: var(--carbonify-error);
  border-color: var(--carbonify-error);
}

.delete-btn:hover {
  background: var(--carbonify-error);
  color: white;
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
  padding: 20px;
}

.modal {
  background: var(--bg-primary, #ffffff);
  border-radius: var(--radius-xl, 1rem);
  max-width: 900px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: var(--shadow-green-lg, 0 20px 40px rgba(6, 158, 45, 0.2));
  border: 2px solid var(--border-green-light, #d4edda);
}

.project-detail-modal {
  max-width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--carbonify-text);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--carbonify-muted);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--carbonify-text);
}

.modal-content {
  padding: 0 24px;
}

.project-detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--carbonify-bg);
  border-radius: var(--radius);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item strong {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--carbonify-muted);
}

.project-detail-section {
  margin-bottom: 24px;
}

.project-detail-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--carbonify-text);
}

.project-detail-section p {
  margin: 0;
  color: var(--carbonify-text);
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 24px;
  border-top: 1px solid var(--carbonify-border);
}

.modal-meta-item .material-symbols-outlined {
  font-size: 1.1rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .projects-view {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .projects-grid {
    grid-template-columns: 1fr;
  }

  .project-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .project-actions {
    justify-content: center;
  }
}
</style>
