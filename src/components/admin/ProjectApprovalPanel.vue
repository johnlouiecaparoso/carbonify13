<template>
  <div class="project-approval-panel">
    <div class="panel-header">
      <h2>Project Management Panel</h2>
      <p>Manage the MRV workflow from submission through validation and issuance.</p>
      <div class="filter-tabs">
        <button 
          :class="['filter-tab', { active: statusFilter === 'all' }]"
          @click="statusFilter = 'all'"
        >
          All Projects ({{ allProjects.length }})
        </button>
        <button 
          :class="['filter-tab', { active: statusFilter === 'submitted' }]"
          @click="statusFilter = 'submitted'"
        >
          Submitted ({{ allProjects.filter(p => p.status === 'submitted').length }})
        </button>
        <button
          :class="['filter-tab', { active: statusFilter === 'in_review' }]"
          @click="statusFilter = 'in_review'"
        >
          In Review ({{ allProjects.filter(p => p.status === 'in_review').length }})
        </button>
        <button 
          :class="['filter-tab', { active: statusFilter === 'needs_revision' }]"
          @click="statusFilter = 'needs_revision'"
        >
          Needs Revision ({{ allProjects.filter(p => p.status === 'needs_revision').length }})
        </button>
        <button 
          :class="['filter-tab', { active: statusFilter === 'validated' }]"
          @click="statusFilter = 'validated'"
        >
          Validated ({{ allProjects.filter(p => p.status === 'validated').length }})
        </button>
        <button 
          :class="['filter-tab', { active: statusFilter === 'rejected' }]"
          @click="statusFilter = 'rejected'"
        >
          Rejected ({{ allProjects.filter(p => p.status === 'rejected').length }})
        </button>
      </div>
    </div>

    <div v-if="decisionCard" :class="['decision-card', `decision-card--${decisionCard.tone}`]">
      <div>
        <strong>{{ decisionCard.title }}</strong>
        <p>{{ decisionCard.message }}</p>
      </div>
      <button class="decision-card__close" type="button" @click="clearDecisionCard">×</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading projects...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="errorMessage" class="error-state">
      <p class="error-message">{{ errorMessage }}</p>
      <button @click="loadPendingProjects" class="retry-btn">Retry</button>
    </div>

    <!-- No Projects -->
    <div v-else-if="displayedProjects.length === 0" class="no-projects">
      <div class="no-projects-icon" aria-hidden="true">
        <span class="material-symbols-outlined">inventory</span>
      </div>
      <h3>No Projects Found</h3>
      <p v-if="statusFilter === 'all'">There are currently no projects in the system.</p>
      <p v-else>There are currently no {{ statusFilter }} projects.</p>
    </div>

    <!-- Projects List -->
    <div v-else class="projects-layout">
      <aside class="project-list">
        <button
          v-for="project in displayedProjects"
          :key="project.id"
          type="button"
          :class="['project-list-item', { active: project.id === activeProjectId }]"
          @click="activeProjectId = project.id"
        >
          <span class="project-list-title">{{ project.title }}</span>
          <span class="project-list-badges">
            <span :class="['status-badge', project.status]">{{ getStatusLabel(project.status) }}</span>
            <span
              v-if="projectOverdue(project)"
              class="sla-badge overdue"
              :title="`Waiting ${ageDays(project)} days — over the ${slaDays}-day SLA`"
            >
              {{ ageDays(project) }}d · overdue
            </span>
          </span>
        </button>
      </aside>

      <section v-if="activeProject" class="project-detail">
        <div class="detail-scroll-content">
          <header class="detail-header">
            <h3 class="detail-title">{{ activeProject.title }}</h3>
            <span :class="['status-badge', activeProject.status]">
              {{ getStatusLabel(activeProject.status) }}
            </span>
          </header>

          <div class="detail-meta">
            <div class="meta-item">
              <span class="material-symbols-outlined" aria-hidden="true">category</span>
              <span>{{ activeProject.category || 'Uncategorized' }}</span>
            </div>
            <div class="meta-item">
              <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
              <span>{{ activeProject.location || 'No location provided' }}</span>
            </div>
            <div class="meta-item">
              <span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
              <span>Submitted {{ formatDate(activeProject.created_at) }} ({{ ageDays(activeProject) }}d ago)</span>
              <span v-if="projectOverdue(activeProject)" class="sla-badge overdue">
                Over {{ slaDays }}-day SLA
              </span>
            </div>
          </div>

          <div class="detail-section">
            <h4>
              <span class="material-symbols-outlined" aria-hidden="true">insights</span>
              <span>Expected Impact</span>
            </h4>
            <p>{{ activeProject.expected_impact || 'No expected impact provided.' }}</p>
          </div>

          <div class="detail-section">
            <h4>
              <span class="material-symbols-outlined" aria-hidden="true">description</span>
              <span>Description</span>
            </h4>
            <p>{{ activeProject.description || 'No description provided.' }}</p>
          </div>

          <div
            v-if="activeProject.project_image || parsedSupportingDocuments(activeProject).length"
            class="detail-section"
          >
            <h4>
              <span class="material-symbols-outlined" aria-hidden="true">attach_file</span>
              <span>Submitted Media & Documents</span>
            </h4>

            <div v-if="activeProject.project_image" class="submitted-image-wrap">
              <img
                :src="activeProject.project_image"
                :alt="`${activeProject.title} project image`"
                class="submitted-image"
              />
            </div>

            <ul v-if="parsedSupportingDocuments(activeProject).length" class="submitted-doc-list">
              <li v-for="(doc, index) in parsedSupportingDocuments(activeProject)" :key="`${doc.name || 'doc'}-${index}`">
                <a v-if="doc.url" :href="doc.url" target="_blank" rel="noopener noreferrer">
                  {{ doc.name || `Document ${index + 1}` }}
                </a>
                <span v-else>{{ doc.name || `Document ${index + 1}` }}</span>
              </li>
            </ul>
          </div>

          <div v-if="activeProject.status === 'rejected' && activeProject.verification_notes" class="detail-section">
            <h4>
              <span class="material-symbols-outlined" aria-hidden="true">info</span>
              <span>Rejection Notes</span>
            </h4>
            <p>{{ activeProject.verification_notes }}</p>
          </div>
        </div>

        <ProjectAssessmentPanel :project="activeProject" />

        <ValidationChecklist :key="activeProject.id" :project-id="activeProject.id" />

        <div class="detail-actions">
          <button
            v-if="['submitted', 'pending'].includes(activeProject.status)"
            class="action-btn outline"
            type="button"
            @click="openVerificationModal(activeProject, 'in_review')"
            :disabled="processing"
          >
            <span class="material-symbols-outlined" aria-hidden="true">flag</span>
            <span>Start MRV Review</span>
          </button>

          <button
            v-if="['submitted', 'pending', 'in_review'].includes(activeProject.status)"
            class="action-btn success"
            type="button"
            @click="openVerificationModal(activeProject, 'validated')"
            :disabled="processing"
          >
            <span class="material-symbols-outlined" aria-hidden="true">done_all</span>
            <span>Validate Project</span>
          </button>

          <button
            v-if="['submitted', 'pending', 'in_review'].includes(activeProject.status)"
            class="action-btn outline"
            type="button"
            @click="openVerificationModal(activeProject, 'needs_revision')"
            :disabled="processing"
          >
            <span class="material-symbols-outlined" aria-hidden="true">edit_note</span>
            <span>Request Revision</span>
          </button>

          <button
            v-if="['submitted', 'pending', 'in_review'].includes(activeProject.status)"
            class="action-btn outline danger"
            type="button"
            @click="openVerificationModal(activeProject, 'rejected')"
            :disabled="processing"
          >
            <span class="material-symbols-outlined" aria-hidden="true">cancel</span>
            <span>Reject Project</span>
          </button>

          <button
            v-if="['validated', 'needs_revision', 'rejected', 'approved'].includes(activeProject.status)"
            class="action-btn outline"
            type="button"
            @click="openVerificationModal(activeProject, 'in_review')"
            :disabled="processing"
          >
            <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
            <span>Re-review</span>
          </button>

          <button
            v-if="userStore.isAdmin"
            class="action-btn danger"
            type="button"
            @click="deleteProject(activeProject.id)"
            :disabled="processing"
            title="Delete project permanently (Admin only)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">delete_forever</span>
            <span>Delete Project</span>
          </button>
        </div>

        <ProjectCommentThread
          v-if="activeProject"
          :key="activeProject.id"
          :project-id="activeProject.id"
          :allow-internal="true"
        />

        <div
          v-if="activeProject && processingProjects.includes(activeProject.id)"
          class="processing-overlay"
          style="pointer-events: none;"
        >
          <div class="spinner small"></div>
          <span>Processing...</span>
        </div>
      </section>

      <section v-else class="project-detail empty-detail">
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">
            <span class="material-symbols-outlined">assignment</span>
          </div>
          <h3>Select a project</h3>
          <p>Choose a project from the list to view full details.</p>
        </div>
      </section>
    </div>

    <!-- Modern Prompt Modal -->
    <ModernPrompt
      :is-open="promptState.isOpen"
      :type="promptState.type"
      :title="promptState.title"
      :message="promptState.message"
      :confirm-text="promptState.confirmText"
      :cancel-text="promptState.cancelText"
      :show-cancel="promptState.showCancel"
      @confirm="handleConfirm"
      @cancel="handleCancel"
      @close="handleClose"
    />

    <Teleport to="body">
      <Transition name="prompt-fade">
        <div
          v-if="rejectPromptState.isOpen"
          class="prompt-overlay"
          @click="handleRejectOverlayClick"
          @keydown.esc="closeRejectPrompt"
          tabindex="-1"
        >
          <div class="prompt-card" @click.stop>
            <div class="prompt-icon-wrapper" style="background-color: rgba(239, 68, 68, 0.12)">
              <span class="prompt-icon material-symbols-outlined" style="color: #ef4444" aria-hidden="true">
                cancel
              </span>
            </div>

            <div class="prompt-content">
              <h3 class="prompt-title">
                {{ rejectPromptState.mode === 'needs_revision' ? 'Request revision?' : 'Confirm Rejected?' }}
              </h3>
              <p class="prompt-message-center">
                <template v-if="rejectPromptState.mode === 'needs_revision'">
                  Send "{{ rejectPromptState.projectTitle }}" back to the developer for changes.
                  They'll be able to edit, reply, and resubmit.
                </template>
                <template v-else>
                  Are you sure you want to mark "{{ rejectPromptState.projectTitle }}" as rejected?
                  This action cannot be undone.
                </template>
              </p>

              <div class="reject-notes-group">
                <label class="reject-notes-label" for="reject-notes">
                  {{ rejectPromptState.mode === 'needs_revision'
                    ? 'What needs to change? (shown to the developer)'
                    : 'Rejection notes for project owner' }}
                </label>
                <textarea
                  id="reject-notes"
                  v-model="rejectPromptState.notes"
                  class="reject-notes-input"
                  rows="4"
                  :placeholder="rejectPromptState.mode === 'needs_revision'
                    ? 'List the specific revisions the developer should make before resubmitting.'
                    : 'Explain why this project is rejected and what should be improved.'"
                />
                <p v-if="rejectPromptError" class="reject-notes-error">{{ rejectPromptError }}</p>
              </div>
            </div>

            <div class="prompt-actions">
              <button type="button" class="reject-cancel-btn" @click="closeRejectPrompt">
                Cancel
              </button>
              <button type="button" class="reject-confirm-btn" @click="confirmRejectPrompt">
                {{ rejectPromptState.mode === 'needs_revision' ? 'Request revision' : 'Confirm Rejected' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { projectApprovalService } from '@/services/projectApprovalService'
import { useUserStore } from '@/store/userStore'
import { useModernPrompt } from '@/composables/useModernPrompt'
import { projectService } from '@/services/projectService'
import ModernPrompt from '@/components/ui/ModernPrompt.vue'
import ProjectAssessmentPanel from '@/components/verifier/ProjectAssessmentPanel.vue'
import ProjectCommentThread from '@/components/project/ProjectCommentThread.vue'
import { addProjectComment } from '@/services/projectCommentService'
import ValidationChecklist from '@/components/verifier/ValidationChecklist.vue'
import { getSlaDays, projectAgeDays, isOverdue } from '@/services/verificationService'

const { promptState, confirm, success, error: showErrorPrompt, handleConfirm, handleCancel, handleClose } = useModernPrompt()

const userStore = useUserStore()
const loading = ref(true)
const errorMessage = ref(null)
const allProjects = ref([])
const pendingProjects = ref([])
const statusFilter = ref('all')
const processing = ref(false)
const processingProjects = ref([])
const activeProjectId = ref(null)
const decisionCard = ref(null)
const rejectPromptError = ref('')
const rejectPromptState = ref({
  isOpen: false,
  mode: 'rejected', // 'rejected' | 'needs_revision'
  projectTitle: '',
  notes: '',
  resolve: null,
})

// Computed property for displayed projects based on filter
const displayedProjects = computed(() => {
  if (statusFilter.value === 'all') {
    return allProjects.value
  }
  return allProjects.value.filter(p => p.status === statusFilter.value)
})

const activeProject = computed(() =>
  displayedProjects.value.find((project) => project.id === activeProjectId.value) || null,
)

const slaDays = ref(5)

// SLA helpers for the queue (age + overdue flag).
function ageDays(project) {
  return projectAgeDays(project)
}
function projectOverdue(project) {
  return isOverdue(project, slaDays.value)
}

onMounted(() => {
  loadPendingProjects()
  getSlaDays().then((d) => {
    slaDays.value = d
  })
})

watch(
  displayedProjects,
  (projects) => {
    if (projects.length === 0) {
      activeProjectId.value = null
      return
    }

    if (!projects.some((project) => project.id === activeProjectId.value)) {
      activeProjectId.value = projects[0].id
    }
  },
  { immediate: true },
)

async function loadPendingProjects(forceRefresh = false) {
  loading.value = true
  errorMessage.value = null

  try {
    // If force refresh, clear the list first to ensure fresh data
    if (forceRefresh) {
      allProjects.value = []
      pendingProjects.value = []
      console.log('Force refreshing projects list from database...')
    }
    
    // Note: The marketplace cleanup function runs automatically when marketplace loads
    // This ensures orphaned records are cleaned up, but we don't need to call it here
    // since we're fetching directly from projects table which only shows existing projects
    
    // Load all projects from Supabase database
    // This fetches fresh data - deleted projects are physically removed and won't appear
    const allProjectsData = await projectApprovalService.getAllProjects()
    
    // Filter out any null/undefined entries (shouldn't happen, but safety check)
    const validProjects = (allProjectsData || []).filter(p => p != null && p.id != null)
    
    // Clear and set fresh data
    allProjects.value = validProjects
    
    // Update pending projects count
    pendingProjects.value = allProjects.value.filter((p) => ['pending', 'submitted'].includes(p.status))
    
    console.log('Loaded projects from Supabase database:', {
      total: allProjects.value.length,
      pending: pendingProjects.value.length,
      approved: allProjects.value.filter(p => p.status === 'approved').length,
      rejected: allProjects.value.filter(p => p.status === 'rejected').length,
      note: 'Deleted projects are physically removed from database and will not appear here'
    })
  } catch (err) {
    console.error('Error loading projects:', err)
    errorMessage.value = err.message || 'Failed to load projects'
  } finally {
    loading.value = false
  }
}

async function deleteProject(projectId) {
  const project = allProjects.value.find((p) => p.id === projectId)
  if (!project) {
    console.warn('Project not found in list:', projectId)
    return
  }

  // Prevent multiple simultaneous calls for same project
  if (processingProjects.value.includes(projectId)) {
    console.warn('Project deletion already in progress for:', projectId)
    return
  }

  // Check if user is admin
  if (!userStore.isAdmin) {
    await showErrorPrompt({
      title: 'Access Denied',
      message: 'Only administrators can delete projects.',
      confirmText: 'OK',
    })
    return
  }

  // Show confirmation prompt with warning
  const confirmed = await confirm({
    type: 'warning',
    title: 'Delete Project?',
    message: `Warning: Are you sure you want to permanently delete "${project.title}"?\n\nThis action cannot be undone and will:\n- Remove the project from the system\n- Delete all associated credits and listings\n- Delete all related data\n\nThis is a permanent action!`,
    confirmText: 'Delete Permanently',
    cancelText: 'Cancel',
  })

  if (!confirmed) {
    return
  }

  processingProjects.value.push(projectId)
  processing.value = true

  try {
    console.log('Admin deleting project:', projectId)
    
    // Use admin delete function which bypasses status checks
    const result = await projectService.adminDeleteProject(projectId)
    
    if (!result) {
      throw new Error('Delete operation returned false')
    }

    console.log('Project deleted successfully:', projectId)

    // Remove from all lists immediately (optimistic update)
    allProjects.value = allProjects.value.filter((p) => p.id !== projectId)
    pendingProjects.value = pendingProjects.value.filter((p) => p.id !== projectId)

    // Force a complete refresh of the list from database to verify deletion
    console.log('Reloading projects list from database to verify deletion...')
    
    // Wait a moment to ensure database operation completes
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Force refresh the list - this will fetch fresh data from Supabase
    await loadPendingProjects(true)
    
    // Double-check: Verify the project is not in the list
    const stillExists = allProjects.value.find(p => p.id === projectId)
    if (stillExists) {
      console.error('Critical: Project still appears in list after deletion!', projectId)
      throw new Error('Project deletion verification failed - project still appears in the list')
    }
    
    console.log('Verification: Project confirmed removed from interface and database')

    // Show modern success prompt
    await success({
      title: 'Project Deleted!',
      message: `"${project.title}" has been permanently deleted from the system and database.`,
      confirmText: 'OK',
    })
  } catch (err) {
    console.error('Error deleting project:', err)
    await showErrorPrompt({
      title: 'Deletion Failed',
      message: err.message || 'Failed to delete project. Please check console for details and try again.',
      confirmText: 'OK',
    })
  } finally {
    processingProjects.value = processingProjects.value.filter((id) => id !== projectId)
    processing.value = processingProjects.value.length > 0
  }
}

function clearDecisionCard() {
  decisionCard.value = null
}

function setDecisionCard(project, status) {
  const projectTitle = project?.title || 'The project'

  if (status === 'approved') {
    decisionCard.value = {
      tone: 'approved',
      title: 'Project Approved',
      message: `${projectTitle} has been approved and the owner can now continue with the approved project flow.`,
    }
    return
  }

  if (status === 'rejected') {
    decisionCard.value = {
      tone: 'rejected',
      title: 'Project Rejected',
      message: `${projectTitle} has been rejected and the owner can review the verifier decision.`,
    }
    return
  }

  decisionCard.value = {
    tone: 'review',
    title: 'Project Under Review',
    message: `${projectTitle} has been moved into under review status.`,
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'submitted':
      return 'Submitted'
    case 'under_review':
    case 'in_review':
      return 'In Review'
    case 'needs_revision':
      return 'Needs Revision'
    case 'approved':
    case 'validated':
      return 'Validated'
    case 'rejected':
      return 'Rejected'
    default:
      return normalized.toUpperCase()
  }
}

function parsedSupportingDocuments(project) {
  if (!project?.supporting_documents) return []

  try {
    const parsed =
      typeof project.supporting_documents === 'string'
        ? JSON.parse(project.supporting_documents)
        : project.supporting_documents

    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.warn('Failed to parse supporting documents:', error)
    return []
  }
}

function openRejectPrompt(project, mode = 'rejected') {
  return new Promise((resolve) => {
    rejectPromptError.value = ''
    rejectPromptState.value = {
      isOpen: true,
      mode,
      projectTitle: project?.title || 'this project',
      notes: mode === 'needs_revision' ? '' : project?.verification_notes || '',
      resolve,
    }
  })
}

function closeRejectPrompt(result = null) {
  const resolver = rejectPromptState.value.resolve
  rejectPromptState.value = {
    isOpen: false,
    mode: 'rejected',
    projectTitle: '',
    notes: '',
    resolve: null,
  }
  rejectPromptError.value = ''
  if (typeof resolver === 'function') {
    resolver(result)
  }
}

function handleRejectOverlayClick(event) {
  if (event.target === event.currentTarget) {
    closeRejectPrompt(null)
  }
}

function confirmRejectPrompt() {
  const notes = String(rejectPromptState.value.notes || '').trim()
  if (notes.length < 5) {
    rejectPromptError.value =
      rejectPromptState.value.mode === 'needs_revision'
        ? 'Please describe what needs to change (at least 5 characters).'
        : 'Please provide a rejection note with at least 5 characters.'
    return
  }

  closeRejectPrompt(notes)
}

async function openVerificationModal(project, newStatus) {
  console.log('Opening verification modal for project:', project.id, 'to status:', newStatus)
  const statusLabel = getStatusLabel(newStatus)

  let verifierNotes = ''
  let confirmed = false

  if (newStatus === 'rejected' || newStatus === 'needs_revision') {
    const notes = await openRejectPrompt(project, newStatus)
    if (!notes) {
      return
    }
    verifierNotes = notes
    confirmed = true
  } else {
    confirmed = await confirm({
      type: 'success',
      title: `Confirm ${statusLabel}?`,
      message: `Are you sure you want to mark "${project.title}" as ${statusLabel.toLowerCase()}? This action cannot be undone.`,
      confirmText: `Confirm ${statusLabel}`,
      cancelText: 'Cancel',
    })
  }

  if (!confirmed) {
    return
  }

  processingProjects.value.push(project.id)
  processing.value = true

  try {
    const result = await projectApprovalService.updateProjectStatus(project.id, newStatus, verifierNotes)
    console.log('Project status updated:', result)

    // Mirror the revision reason into the comment thread so the developer can
    // reply and the back-and-forth is recorded in one place.
    if (newStatus === 'needs_revision' && verifierNotes) {
      try {
        await addProjectComment(project.id, verifierNotes, { authorRole: userStore.role })
      } catch (commentErr) {
        console.warn('Could not post revision comment (non-critical):', commentErr?.message)
      }
    }

    // Update project status in all lists
    const projectIndex = allProjects.value.findIndex(p => p.id === project.id)
    if (projectIndex !== -1) {
      allProjects.value[projectIndex].status = newStatus
      allProjects.value[projectIndex].verification_notes = verifierNotes || null
    }
    pendingProjects.value = pendingProjects.value.filter((p) => p.id !== project.id)

    // Reload the list to ensure consistency
    await loadPendingProjects()

    setDecisionCard(project, newStatus)

    // Show modern success prompt
    await success({
      title: `${statusLabel} Complete`,
      message: `"${project.title}" has been marked as ${statusLabel.toLowerCase()}.`,
      confirmText: 'OK',
    })
  } catch (err) {
    console.error('Error updating project status:', err)
    await showErrorPrompt({
      title: `${statusLabel} Failed`,
      message: err.message || `Failed to mark the project as ${statusLabel.toLowerCase()}. Please try again.`,
      confirmText: 'OK',
    })
  } finally {
    processingProjects.value = processingProjects.value.filter((id) => id !== project.id)
    processing.value = processingProjects.value.length > 0
  }
}
</script>

<style scoped>
.project-approval-panel {
  background: transparent;
  padding: 0;
}

.panel-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ecolink-border, #e5e7eb);
}

.decision-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 16px;
  border: 1px solid transparent;
}

.decision-card strong {
  display: block;
  margin-bottom: 0.25rem;
}

.decision-card p {
  margin: 0;
  color: inherit;
}

.decision-card--approved {
  background: #ecfdf3;
  border-color: #bbf7d0;
  color: #166534;
}

.decision-card--rejected {
  background: #fef2f2;
  border-color: #fecaca;
  color: #991b1b;
}

.decision-card--review {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.decision-card__close {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.panel-header h2 {
  margin: 0 0 8px 0;
  color: var(--ecolink-text, #111827);
  font-size: 26px;
  font-weight: 700;
}

.panel-header p {
  margin: 0;
  color: var(--ecolink-muted, #6b7280);
}

.filter-tabs {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.25rem;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 0.55rem 1.1rem;
  border: 1px solid var(--ecolink-border, #e5e7eb);
  background: white;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ecolink-text, #111827);
  transition: all 0.2s ease;
}

.filter-tab:hover {
  border-color: var(--primary-color, #10b981);
  color: var(--primary-color, #10b981);
}

.filter-tab.active {
  background: var(--primary-color, #10b981);
  border-color: var(--primary-color, #10b981);
  color: white;
  box-shadow: 0 10px 18px rgba(16, 185, 129, 0.18);
}

.loading-state,
.error-state,
.no-projects {
  text-align: center;
  padding: 48px 24px;
  color: var(--ecolink-muted, #6b7280);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(0, 0, 0, 0.08);
  border-top-color: var(--primary-color, #10b981);
  border-radius: 50%;
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinner.small {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.error-message {
  color: #dc2626;
  margin-bottom: 16px;
}

.retry-btn {
  padding: 10px 18px;
  background: var(--primary-color, #10b981);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s ease;
}

.retry-btn:hover {
  background: #059669;
}

.prompt-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.prompt-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 520px;
  width: 100%;
  padding: 2rem;
}

.prompt-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.prompt-icon {
  font-size: 2rem;
}

.prompt-content {
  margin-bottom: 1.5rem;
}

.prompt-title {
  margin: 0 0 0.75rem;
  text-align: center;
  font-size: 1.9rem;
  font-weight: 700;
  color: #111827;
}

.prompt-message-center {
  margin: 0;
  color: #6b7280;
  font-size: 1.05rem;
  text-align: center;
  line-height: 1.6;
}

.reject-notes-group {
  margin-top: 1.2rem;
  max-width: 470px;
  margin-left: auto;
  margin-right: auto;
}

.reject-notes-label {
  display: block;
  margin-bottom: 0.45rem;
  font-size: 0.93rem;
  font-weight: 600;
  color: #374151;
}

.reject-notes-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #ffffff;
  padding: 0.75rem 0.85rem;
  font-size: 0.95rem;
  line-height: 1.5;
  color: #111827;
  resize: vertical;
  min-height: 112px;
}

.reject-notes-input:focus {
  outline: none;
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

.reject-notes-error {
  margin: 0.45rem 0 0;
  color: #dc2626;
  font-size: 0.85rem;
}

.prompt-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  max-width: 470px;
  margin: 0 auto;
}

.reject-cancel-btn,
.reject-confirm-btn {
  min-width: 170px;
  border-radius: 12px;
  padding: 0.8rem 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reject-cancel-btn {
  border: 1px solid #ef4444;
  background: white;
  color: #b91c1c;
}

.reject-cancel-btn:hover {
  background: #fef2f2;
}

.reject-confirm-btn {
  border: 1px solid #ef4444;
  background: #ef4444;
  color: white;
}

.reject-confirm-btn:hover {
  background: #dc2626;
  border-color: #dc2626;
}

.prompt-fade-enter-active,
.prompt-fade-leave-active {
  transition: opacity 0.25s ease;
}

.prompt-fade-enter-from,
.prompt-fade-leave-to {
  opacity: 0;
}

.no-projects-icon {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  border-radius: 0.75rem;
  background: rgba(37, 99, 235, 0.12);
  color: #1d4ed8;
}

.no-projects-icon .material-symbols-outlined {
  font-size: 1.9rem;
}

.projects-layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 24px;
  align-items: flex-start;
  width: 100%;
  min-height: 0;
}

.project-list {
  display: flex;
  flex-direction: column;
  background: var(--ecolink-surface, #ffffff);
  border: 1px solid var(--ecolink-border, #e5e7eb);
  border-radius: 16px;
  overflow: hidden;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
}

.project-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  font-weight: 600;
  color: var(--ecolink-text, #111827);
  transition: background 0.15s ease;
}

.project-list-item + .project-list-item {
  border-top: 1px solid var(--ecolink-border, #e5e7eb);
}

.project-list-item:hover {
  background: rgba(16, 185, 129, 0.08);
}

.project-list-item.active {
  background: rgba(16, 185, 129, 0.16);
  border-left: 3px solid var(--primary-color, #10b981);
}

.project-list-title {
  flex: 1;
  font-size: 0.95rem;
}

.project-list-badges {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.sla-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.sla-badge.overdue {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.status-badge.pending {
  background: rgba(253, 224, 71, 0.18);
  color: #92400e;
}

.status-badge.under_review {
  background: rgba(147, 197, 253, 0.2);
  color: #1d4ed8;
}

.status-badge.approved {
  background: rgba(34, 197, 94, 0.18);
  color: #166534;
}

.status-badge.rejected {
  background: rgba(248, 113, 113, 0.2);
  color: #9f1239;
}

.project-detail {
  position: relative;
  background: var(--ecolink-surface, #ffffff);
  border: 1px solid var(--ecolink-border, #e5e7eb);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 380px;
  min-width: 0;
  max-height: calc(100vh - 260px);
  overflow: hidden;
}

.detail-scroll-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-right: 6px;
}

.project-detail.empty-detail {
  align-items: center;
  justify-content: center;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.detail-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ecolink-text, #0f172a);
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  color: var(--ecolink-muted, #6b7280);
  font-size: 0.95rem;
}

.detail-meta .meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.detail-meta .material-symbols-outlined {
  font-size: 1.05rem;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detail-section h4 {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ecolink-text, #111827);
}

.detail-section h4 .material-symbols-outlined {
  font-size: 1.2rem;
  color: var(--primary-color, #10b981);
}

.detail-section p {
  margin: 0;
  color: var(--ecolink-text, #374151);
  line-height: 1.6;
}

.submitted-image-wrap {
  margin-top: 0.5rem;
}

.submitted-image {
  max-width: min(100%, 420px);
  border-radius: 10px;
  border: 1px solid var(--ecolink-border, #e5e7eb);
}

.submitted-doc-list {
  margin: 0.35rem 0 0;
  padding-left: 1rem;
}

.submitted-doc-list li {
  margin-bottom: 0.35rem;
}

.detail-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: auto;
  border-top: 1px solid var(--ecolink-border, #e5e7eb);
  background: #ffffff;
  padding: 12px 0 0;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.65rem 1.15rem;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}

.action-btn .material-symbols-outlined {
  font-size: 1.25rem;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.success {
  background: var(--primary-color, #10b981);
  color: white;
  box-shadow: 0 12px 20px rgba(16, 185, 129, 0.22);
}

.action-btn.success:hover:not(:disabled) {
  background: #059669;
}

.action-btn.danger {
  background: #dc2626;
  color: white;
  box-shadow: 0 12px 20px rgba(220, 38, 38, 0.2);
}

.action-btn.danger:hover:not(:disabled) {
  background: #b91c1c;
}

.action-btn.outline {
  background: transparent;
  border-color: var(--ecolink-border, #e5e7eb);
  color: var(--ecolink-text, #111827);
}

.action-btn.outline:hover:not(:disabled) {
  border-color: var(--primary-color, #10b981);
  color: var(--primary-color, #10b981);
}

.action-btn.outline.danger {
  border-color: #dc2626;
  color: #dc2626;
}

.action-btn.outline.danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.08);
}

.processing-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.82);
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  backdrop-filter: blur(2px);
}

@media (max-width: 1024px) {
  .projects-layout {
    grid-template-columns: 1fr;
  }

  .project-list {
    flex-direction: row;
    overflow-x: auto;
    border-radius: 16px 16px 0 0;
    max-height: none;
    overflow-y: visible;
  }

  .project-list-item,
  .project-list-item + .project-list-item {
    border-top: none;
    border-right: 1px solid var(--ecolink-border, #e5e7eb);
    min-width: 220px;
  }

  .project-detail {
    border-top-left-radius: 0;
    max-height: none;
    overflow: visible;
  }

  .detail-scroll-content {
    overflow-y: visible;
    padding-right: 0;
  }
}

@media (max-width: 768px) {
  .filter-tabs {
    flex-direction: column;
    align-items: flex-start;
  }

  .project-list {
    flex-direction: column;
  }

  .project-list-item,
  .project-list-item + .project-list-item {
    border-right: none;
    border-top: 1px solid var(--ecolink-border, #e5e7eb);
  }

  .detail-actions {
    flex-direction: column;
    align-items: stretch;
    position: static;
    background: none;
    padding: 0;
  }
}
</style>
