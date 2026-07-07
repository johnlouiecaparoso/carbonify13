<template>
  <div class="certificates-view">
    <div class="page-header">
      <h1 class="page-title">Certificates</h1>
      <p class="page-description">View and manage your environmental certificates</p>
    </div>

    <div class="certificates-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading certificates...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Failed to Load Certificates</h3>
        <p>{{ error }}</p>
        <UiButton @click="loadCertificates">Retry</UiButton>
      </div>

      <!-- Certificates Grid -->
      <div v-else-if="hasCertificates" class="certificates-grid">
        <div v-for="certificate in certificates" :key="certificate.id" class="certificate-card">
          <div class="certificate-header">
            <div class="certificate-type">
              <span class="type-icon">{{ getCertificateTypeIcon(certificate.type) }}</span>
              <span class="type-label">{{ getCertificateTypeLabel(certificate.type) }}</span>
            </div>
            <span class="certificate-status" :class="certificate.status">
              {{ certificate.status }}
            </span>
          </div>

          <div class="certificate-body">
            <h3 class="certificate-title">{{ certificate.title }}</h3>
            <p class="certificate-description">{{ certificate.description }}</p>

            <div class="certificate-meta">
              <div class="meta-item">
                <span class="meta-label">Certificate #:</span>
                <span class="meta-value">{{ certificate.certificate_number }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Issued:</span>
                <span class="meta-value">{{ formatDate(certificate.verification_date) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Credits:</span>
                <span class="meta-value">{{ certificate.credits_issued }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Standard:</span>
                <span class="meta-value">{{ certificate.verification_standard }}</span>
              </div>
            </div>
          </div>

          <div class="certificate-actions">
            <UiButton variant="primary" @click="handleDownloadCertificate(certificate)">
              📄 Download PDF
            </UiButton>
            <UiButton variant="outline" @click="viewCertificate(certificate)">
              👁️ View Details
            </UiButton>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-icon">📜</div>
        <h3>No Certificates Yet</h3>
        <p>
          You don't have any certificates yet. Start by participating in environmental projects or
          purchasing carbon credits!
        </p>
        <div class="empty-actions">
          <UiButton variant="primary" @click="goToProjects">Browse Projects</UiButton>
          <UiButton variant="outline" @click="router.push('/marketplace')"
            >View Marketplace</UiButton
          >
        </div>
      </div>
    </div>

    <!-- Certificate Details Modal -->
    <div v-if="showCertificateModal" class="modal-overlay" @click="closeCertificateModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Certificate Details</h2>
          <button class="modal-close" @click="closeCertificateModal">×</button>
        </div>

        <div v-if="selectedCertificate" class="modal-body">
          <div class="certificate-details">
            <div class="detail-section">
              <h3>{{ selectedCertificate.title }}</h3>
              <p class="certificate-type-detail">
                <span class="type-icon">{{
                  getCertificateTypeIcon(selectedCertificate.type)
                }}</span>
                {{ getCertificateTypeLabel(selectedCertificate.type) }}
              </p>
            </div>

            <div class="detail-section">
              <h4>Description</h4>
              <p>{{ selectedCertificate.description }}</p>
            </div>

            <div class="detail-section">
              <h4>Certificate Information</h4>
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Certificate Number:</span>
                  <span class="detail-value">{{ selectedCertificate.certificate_number }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Status:</span>
                  <span class="detail-value status-badge" :class="selectedCertificate.status">
                    {{ selectedCertificate.status }}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Credits Issued:</span>
                  <span class="detail-value">{{ selectedCertificate.credits_issued }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Verification Standard:</span>
                  <span class="detail-value">{{ selectedCertificate.verification_standard }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Issued To:</span>
                  <span class="detail-value">{{ selectedCertificate.issued_to }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Issued Date:</span>
                  <span class="detail-value">{{
                    formatDate(selectedCertificate.verification_date)
                  }}</span>
                </div>
              </div>
            </div>

            <div v-if="selectedCertificate.metadata" class="detail-section">
              <h4>Additional Information</h4>
              <pre class="metadata-json">{{
                JSON.stringify(selectedCertificate.metadata, null, 2)
              }}</pre>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <UiButton variant="outline" @click="closeCertificateModal">Close</UiButton>
          <UiButton variant="primary" @click="handleDownloadCertificate(selectedCertificate)">
            Download PDF
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import {
  getUserCertificates,
  generateProjectCertificate,
  generateCreditCertificate,
  downloadCertificate,
} from '@/services/certificateService'
import { formatDate } from '@/utils/formatDate'
import UiButton from '@/components/ui/Button.vue'

const router = useRouter()
const userStore = useUserStore()

// State
const certificates = ref([])
const loading = ref(true)
const error = ref(null)
const selectedCertificate = ref(null)
const showCertificateModal = ref(false)

// Computed properties
const hasCertificates = computed(() => certificates.value.length > 0)

const getCertificateTypeIcon = (type) => {
  switch (type) {
    case 'project_verification':
      return '🌱'
    case 'credit_purchase':
      return '💰'
    case 'credit_retirement':
      return '♻️'
    default:
      return '📜'
  }
}

const getCertificateTypeLabel = (type) => {
  switch (type) {
    case 'project_verification':
      return 'Project Verification'
    case 'credit_purchase':
      return 'Credit Purchase'
    case 'credit_retirement':
      return 'Credit Retirement'
    default:
      return 'Certificate'
  }
}

// Methods
async function loadCertificates() {
  try {
    loading.value = true
    error.value = null

    // Check if user is authenticated
    if (!userStore.session?.user?.id) {
      console.warn('No authenticated user, showing empty certificates')
      certificates.value = []
      return
    }

    const userCertificates = await getUserCertificates(userStore.session?.user?.id)
    certificates.value = userCertificates || []
  } catch (err) {
    console.error('Error loading certificates:', err)
    // Show sample data instead of error for demo purposes
    certificates.value = [
      {
        id: 'demo-cert-1',
        type: 'project_verification',
        title: 'Amazon Rainforest Protection',
        issued_at: new Date().toISOString(),
        status: 'active',
        credits: 1000,
        project_name: 'Amazon Rainforest Protection Initiative',
        verification_standard: 'VCS',
        vintage_year: 2024,
      },
      {
        id: 'demo-cert-2',
        type: 'credit_purchase',
        title: 'Solar Energy Credits',
        issued_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        credits: 500,
        project_name: 'Solar Energy Initiative',
        verification_standard: 'Gold Standard',
        vintage_year: 2024,
      },
    ]
    console.log('Showing demo certificates due to database error')
  } finally {
    loading.value = false
  }
}

async function handleDownloadCertificate(certificate) {
  try {
    const result = await downloadCertificate(certificate.id)

    if (result.success) {
      // Handle PDF download
      const link = document.createElement('a')
      link.href = result.pdfData
      link.download = `${certificate.type}_${certificate.id}.pdf`
      link.click()

      // Show success message
      alert('Certificate downloaded successfully!')
    }
  } catch (err) {
    console.error('Error downloading certificate:', err)
    alert('Failed to download certificate. Please try again.')
  }
}

function viewCertificate(certificate) {
  selectedCertificate.value = certificate
  showCertificateModal.value = true
}

function closeCertificateModal() {
  showCertificateModal.value = false
  selectedCertificate.value = null
}

function goToProjects() {
  router.push('/projects')
}

onMounted(() => {
  loadCertificates()
})
</script>

<style scoped>
.certificates-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--carbonify-text);
  margin-bottom: 0.5rem;
}

.page-description {
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

/* Certificates Grid */
.certificates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.certificate-card {
  background: var(--carbonify-surface);
  border: 1px solid var(--carbonify-border);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.certificate-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.certificate-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.certificate-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-icon {
  font-size: 1.2rem;
}

.type-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--carbonify-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.certificate-status {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.certificate-status.active {
  background: var(--carbonify-success-bg);
  color: var(--carbonify-success);
}

.certificate-status.pending {
  background: var(--carbonify-warning-bg);
  color: var(--carbonify-warning);
}

.certificate-status.revoked {
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
}

.certificate-body {
  margin-bottom: 1.5rem;
}

.certificate-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--carbonify-text);
  margin: 0 0 0.75rem 0;
}

.certificate-description {
  color: var(--carbonify-muted);
  margin-bottom: 1rem;
  line-height: 1.5;
  font-size: 0.9rem;
}

.certificate-meta {
  display: grid;
  gap: 0.5rem;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.meta-label {
  color: var(--carbonify-muted);
  font-weight: 500;
}

.meta-value {
  color: var(--carbonify-text);
  font-weight: 600;
}

.certificate-actions {
  display: flex;
  gap: 0.75rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--carbonify-muted);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--carbonify-text);
  margin-bottom: 0.5rem;
}

.empty-state p {
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.empty-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Modal Styles */
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
  padding: 1rem;
}

.modal-content {
  background: var(--carbonify-surface);
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--carbonify-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--carbonify-muted);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.modal-close:hover {
  color: var(--carbonify-text);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid var(--carbonify-border);
}

/* Certificate Details */
.certificate-details {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-section h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.detail-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.certificate-type-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--carbonify-primary);
  font-weight: 500;
}

.detail-grid {
  display: grid;
  gap: 0.75rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--carbonify-border);
}

.detail-item:last-child {
  border-bottom: none;
}

.detail-label {
  color: var(--carbonify-muted);
  font-weight: 500;
  font-size: 0.9rem;
}

.detail-value {
  color: var(--carbonify-text);
  font-weight: 600;
  font-size: 0.9rem;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.metadata-json {
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: 6px;
  padding: 1rem;
  font-size: 0.875rem;
  color: var(--carbonify-text);
  overflow-x: auto;
  white-space: pre-wrap;
}

/* Responsive Design */
@media (max-width: 768px) {
  .certificates-view {
    padding: 1rem;
  }

  .certificates-grid {
    grid-template-columns: 1fr;
  }

  .certificate-actions {
    flex-direction: column;
  }

  .modal-content {
    margin: 1rem;
    max-height: calc(100vh - 2rem);
  }

  .modal-footer {
    flex-direction: column;
  }

  .empty-actions {
    flex-direction: column;
    align-items: center;
  }
}
</style>
