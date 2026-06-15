<template>
  <div class="developer-projects-page">
    <div class="page-header">
      <div class="container">
        <h1 class="page-title">My Project Submissions</h1>
        <p class="page-description">
          Track all submitted projects and review verifier decisions.
        </p>
      </div>
    </div>

    <div class="page-content">
      <div class="container">
        <div class="summary-grid">
          <div class="summary-card">
            <p class="summary-label">Total</p>
            <p class="summary-value">{{ stats.total }}</p>
          </div>
          <div class="summary-card pending">
            <p class="summary-label">Pending</p>
            <p class="summary-value">{{ stats.pending }}</p>
          </div>
          <div class="summary-card revision">
            <p class="summary-label">Needs Revision</p>
            <p class="summary-value">{{ stats.needsRevision }}</p>
          </div>
          <div class="summary-card approved">
            <p class="summary-label">Approved</p>
            <p class="summary-value">{{ stats.approved }}</p>
          </div>
          <div class="summary-card rejected">
            <p class="summary-label">Rejected</p>
            <p class="summary-value">{{ stats.rejected }}</p>
          </div>
        </div>

        <div class="toolbar">
          <div class="status-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.value"
              class="status-tab"
              :class="{ active: activeFilter === tab.value }"
              @click="activeFilter = tab.value"
              type="button"
            >
              {{ tab.label }} ({{ tab.count }})
            </button>
          </div>

          <button class="submit-btn" type="button" @click="goToSubmitProject">
            Submit New Project
          </button>
        </div>

        <div v-if="loading" class="state-card">Loading your projects...</div>
        <div v-else-if="errorMessage" class="state-card error">{{ errorMessage }}</div>
        <div v-else-if="filteredProjects.length === 0" class="state-card">
          No projects found for this status.
        </div>

        <div v-else class="project-list">
          <article v-for="project in filteredProjects" :key="project.id" class="project-card">
            <div class="project-card__header">
              <div>
                <h3 class="project-title">{{ project.title }}</h3>
                <p class="project-meta">
                  {{ project.category || 'Uncategorized' }} • {{ project.location || 'No location' }}
                </p>
              </div>
              <span class="status-badge" :class="statusClass(project.status)">
                {{ statusLabel(project.status) }}
              </span>
            </div>

            <ProjectProgressTracker :project="project" />

            <p class="project-description">{{ project.description || 'No description provided.' }}</p>

            <div class="project-dates">
              <span>Submitted: {{ formatDate(project.created_at) }}</span>
              <span v-if="project.verified_at">Reviewed: {{ formatDate(project.verified_at) }}</span>
            </div>

            <div v-if="project.status === 'rejected'" class="notes-box rejected-note">
              <h4>Rejection Reason</h4>
              <p>{{ project.verification_notes || 'No rejection note was provided by verifier.' }}</p>
            </div>

            <div v-else-if="project.status === 'needs_revision'" class="notes-box revision-note">
              <h4>Revisions Requested</h4>
              <p>{{ project.verification_notes || 'The verifier asked for changes — see the conversation below.' }}</p>
              <div class="revision-actions">
                <button class="resubmit-btn" type="button" @click="goToEdit(project)">
                  Edit details
                </button>
                <button
                  class="resubmit-btn primary"
                  type="button"
                  :disabled="resubmittingId === project.id"
                  @click="resubmit(project)"
                >
                  {{ resubmittingId === project.id ? 'Resubmitting…' : 'Resubmit for review' }}
                </button>
              </div>
            </div>

            <div
              v-else-if="['approved', 'validated'].includes(project.status) && project.verification_notes"
              class="notes-box approved-note"
            >
              <h4>Verifier Notes</h4>
              <p>{{ project.verification_notes }}</p>
            </div>

            <!-- Conversation with the verifier (always available so threads persist
                 across the needs_revision → resubmit → re-review cycle). -->
            <ProjectCommentThread :project-id="project.id" :allow-internal="false" />
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { projectService } from '@/services/projectService'
import { projectApprovalService } from '@/services/projectApprovalService'
import ProjectProgressTracker from '@/components/ProjectProgressTracker.vue'
import ProjectCommentThread from '@/components/project/ProjectCommentThread.vue'

const router = useRouter()

const loading = ref(true)
const errorMessage = ref('')
const projects = ref([])
const activeFilter = ref('all')
const resubmittingId = ref(null)

const has = (project, ...statuses) => statuses.includes(project.status)

const stats = computed(() => ({
  total: projects.value.length,
  pending: projects.value.filter((p) => has(p, 'pending', 'submitted', 'in_review')).length,
  needsRevision: projects.value.filter((p) => has(p, 'needs_revision')).length,
  approved: projects.value.filter((p) => has(p, 'approved', 'validated')).length,
  rejected: projects.value.filter((p) => has(p, 'rejected')).length,
}))

const tabs = computed(() => [
  { value: 'all', label: 'All', count: stats.value.total },
  { value: 'pending', label: 'Pending', count: stats.value.pending },
  { value: 'needs_revision', label: 'Needs Revision', count: stats.value.needsRevision },
  { value: 'approved', label: 'Approved', count: stats.value.approved },
  { value: 'rejected', label: 'Rejected', count: stats.value.rejected },
])

// Map legacy and canonical status values onto the tab buckets.
const TAB_STATUSES = {
  pending: ['pending', 'submitted', 'in_review'],
  needs_revision: ['needs_revision'],
  approved: ['approved', 'validated'],
  rejected: ['rejected'],
}

const filteredProjects = computed(() => {
  if (activeFilter.value === 'all') return projects.value
  const allowed = TAB_STATUSES[activeFilter.value] || [activeFilter.value]
  return projects.value.filter((project) => allowed.includes(project.status))
})

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function statusLabel(status) {
  const labels = {
    pending: 'Pending',
    submitted: 'Pending',
    in_review: 'Under Review',
    under_review: 'Under Review',
    needs_revision: 'Needs Revision',
    approved: 'Approved',
    validated: 'Approved',
    rejected: 'Rejected',
  }
  return labels[status] || status || 'Unknown'
}

function statusClass(status) {
  // Collapse canonical aliases onto the existing badge styles.
  if (['submitted', 'in_review', 'under_review'].includes(status)) return 'pending'
  if (status === 'validated') return 'approved'
  return status || 'unknown'
}

function goToSubmitProject() {
  router.push('/submit-project')
}

function goToEdit(project) {
  // Best-effort: open the submission form for this project. The form reads an
  // optional id query when editing an existing draft.
  router.push({ path: '/submit-project', query: { id: project.id } })
}

async function resubmit(project) {
  resubmittingId.value = project.id
  try {
    await projectApprovalService.resubmitProject(project.id)
    await loadProjects()
  } catch (error) {
    console.error('Resubmit failed:', error)
    errorMessage.value = error.message || 'Failed to resubmit project.'
  } finally {
    resubmittingId.value = null
  }
}

async function loadProjects() {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await projectService.getUserProjects()
    projects.value = (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  } catch (error) {
    console.error('Error loading developer projects:', error)
    errorMessage.value = error.message || 'Failed to load project submissions.'
    projects.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.developer-projects-page {
  min-height: 100vh;
  background: var(--bg-primary, #ffffff);
}

.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 2rem;
}

.page-header {
  padding: 2rem 0;
  background: var(--primary-color, #10b981);
}

.page-title {
  font-size: 2.2rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 0.5rem;
}

.page-description {
  color: #fff;
  margin: 0;
}

.page-content {
  padding: 2rem 0 3rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
}

.summary-label {
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
}

.summary-value {
  margin: 0.25rem 0 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: #0f172a;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.status-tabs {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.status-tab {
  border: 1px solid #cbd5e1;
  background: #fff;
  padding: 0.55rem 0.95rem;
  border-radius: 999px;
  cursor: pointer;
  color: #334155;
}

.status-tab.active {
  border-color: var(--primary-color, #10b981);
  color: var(--primary-color, #10b981);
  background: #ecfdf5;
}

.submit-btn {
  border: none;
  background: var(--primary-color, #10b981);
  color: #fff;
  padding: 0.65rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}

.state-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  color: #334155;
}

.state-card.error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.project-list {
  display: grid;
  gap: 1rem;
}

.project-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.2rem;
}

.project-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.project-title {
  margin: 0;
  font-size: 1.15rem;
  color: #0f172a;
}

.project-meta {
  margin: 0.25rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.project-description {
  margin: 0.9rem 0;
  color: #334155;
}

.project-dates {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: #64748b;
  font-size: 0.85rem;
}

.status-badge {
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.3rem 0.65rem;
}

.status-badge.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.approved {
  background: #dcfce7;
  color: #166534;
}

.status-badge.rejected {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.under_review {
  background: #e0f2fe;
  color: #075985;
}

.status-badge.needs_revision {
  background: #fef3c7;
  color: #92400e;
}

.notes-box {
  margin-top: 1rem;
  border-radius: 10px;
  padding: 0.9rem;
}

.notes-box h4 {
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
}

.notes-box p {
  margin: 0;
}

.rejected-note {
  background: #fff1f2;
  border: 1px solid #fecdd3;
}

.approved-note {
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
}

.revision-note {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.revision-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.resubmit-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.resubmit-btn.primary {
  background: #069e2d;
  border-color: #069e2d;
  color: #fff;
}

.resubmit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
