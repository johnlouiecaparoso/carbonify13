<template>
  <div class="simple-project-approval">
    <div class="header">
      <h2>
        <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
        Quick Project Approval
      </h2>
      <p>Approve projects to make them appear in the marketplace</p>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading projects...</p>
    </div>

    <div v-else-if="projects.length === 0" class="empty">
      <div class="empty-icon">
        <span class="material-symbols-outlined" aria-hidden="true">assignment</span>
      </div>
      <h3>No Projects Found</h3>
      <p>Submit a project first to see it here</p>
    </div>

    <div v-else class="projects-list">
      <div v-for="project in projects" :key="project.id" class="project-card">
        <div class="project-header">
          <h3>{{ project.title }}</h3>
          <span class="status-badge" :class="project.status">{{ project.status }}</span>
        </div>

        <div class="project-info">
          <div class="info-row"><strong>Category:</strong> {{ project.category }}</div>
          <div class="info-row"><strong>Location:</strong> {{ project.location }}</div>
          <div class="info-row">
            <strong>Submitted:</strong> {{ formatDate(project.created_at) }}
          </div>
        </div>

        <div class="project-description">
          <strong>Description:</strong>
          <p>{{ project.description }}</p>
        </div>

        <div class="project-impact">
          <strong>Expected Impact:</strong>
          <p>{{ project.expected_impact }}</p>
        </div>

        <div v-if="project.status === 'pending'" class="approval-section">
          <div class="approval-notes">
            <label>Approval Notes (optional):</label>
            <textarea
              v-model="project.approvalNotes"
              placeholder="Add notes about this approval..."
              rows="2"
            ></textarea>
          </div>

          <div class="approval-buttons">
            <button
              class="btn-approve"
              @click="approveProject(project)"
              :disabled="project.processing"
            >
              {{ project.processing ? 'Approving...' : 'Approve & Generate Credits' }}
            </button>
          </div>
        </div>

        <div v-else-if="project.status === 'approved'" class="approved-section">
          <div class="success-message">
            <span class="material-symbols-outlined" aria-hidden="true">check_circle</span>
            Project approved! Credits have been generated and listed in marketplace.
          </div>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h3>How it works:</h3>
      <ol>
        <li>Submit a project using the "Submit Project" form</li>
        <li>Come here and approve the project</li>
        <li>Credits will be automatically generated and listed in marketplace</li>
        <li>Go to marketplace to see your project's credits</li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { projectApprovalService } from '@/services/projectApprovalService'

// State
const loading = ref(true)
const projects = ref([])

// Load projects
async function loadProjects() {
  try {
    loading.value = true
    const allProjects = await projectApprovalService.getAllProjects()
    projects.value = allProjects.map((project) => ({
      ...project,
      approvalNotes: '',
      processing: false,
    }))
  } catch (error) {
    console.error('Error loading projects:', error)
    alert('Failed to load projects. Please check your Supabase connection.')
  } finally {
    loading.value = false
  }
}

// Approve project
async function approveProject(project) {
  try {
    project.processing = true

    const result = await projectApprovalService.approveProject(project.id, project.approvalNotes)

    console.log('Project approved:', result)

    // Update project status locally
    project.status = 'approved'
    project.processing = false

    // Show success message
    alert(
      `Project "${project.title}" approved successfully!\n\nCredits generated: ${result.credits?.total_credits || 'Unknown'}\nPrice per credit: $${result.credits?.price_per_credit || 'Unknown'}\n\nYour project is now live in the marketplace!`,
    )
  } catch (error) {
    console.error('Error approving project:', error)
    alert('Failed to approve project. Please try again.')
    project.processing = false
  }
}

// Format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Load projects on mount
onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.simple-project-approval {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h2 {
  color: var(--carbonify-primary, #069e2d);
  margin-bottom: 8px;
}

.loading {
  text-align: center;
  padding: 48px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid var(--carbonify-primary, #069e2d);
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

.empty {
  text-align: center;
  padding: 48px;
  color: #718096;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.projects-list {
  display: grid;
  gap: 24px;
  margin-bottom: 48px;
}

.project-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.project-header h3 {
  color: var(--carbonify-primary, #069e2d);
  margin: 0;
  flex: 1;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.pending {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.approved {
  background: #d1fae5;
  color: #059669;
}

.project-info {
  margin-bottom: 16px;
}

.info-row {
  margin-bottom: 8px;
  color: #4a5568;
}

.project-description,
.project-impact {
  margin-bottom: 16px;
}

.project-description p,
.project-impact p {
  margin: 8px 0 0 0;
  line-height: 1.6;
  color: #4a5568;
}

.approval-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
}

.approval-notes {
  margin-bottom: 20px;
}

.approval-notes label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #1a202c;
}

.approval-notes textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  transition: border-color 0.2s;
}

.approval-notes textarea:focus {
  outline: none;
  border-color: var(--carbonify-primary, #069e2d);
}

.approval-buttons {
  text-align: right;
}

.btn-approve {
  background: var(--carbonify-primary, #069e2d);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-approve:hover:not(:disabled) {
  background: var(--carbonify-primary-hover, #058e3f);
  transform: translateY(-1px);
}

.btn-approve:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.approved-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
}

.success-message {
  background: #d1fae5;
  color: #059669;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  font-weight: 500;
}

.help-section {
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  margin-top: 32px;
}

.help-section h3 {
  color: var(--carbonify-primary, #069e2d);
  margin-bottom: 16px;
}

.help-section ol {
  margin: 0;
  padding-left: 20px;
}

.help-section li {
  margin-bottom: 8px;
  line-height: 1.6;
}

/* Responsive Design */
@media (max-width: 768px) {
  .simple-project-approval {
    padding: 16px;
  }

  .project-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .approval-buttons {
    text-align: center;
  }

  .btn-approve {
    width: 100%;
  }
}
</style>













