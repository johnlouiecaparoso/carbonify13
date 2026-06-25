<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/userStore'
import { projectService } from '@/services/projectService'
import { projectWorkflowService } from '@/services/projectWorkflowService'
import { projectApprovalService } from '@/services/projectApprovalService'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import { PROJECT_TYPES, isValidProjectType } from '@/constants/projectTypes'

const props = defineProps({
  project: {
    type: Object,
    default: null,
  },
  mode: {
    type: String,
    default: 'create', // 'create' or 'edit'
    validator: (value) => ['create', 'edit'].includes(value),
  },
})

const emit = defineEmits(['success', 'cancel'])

const userStore = useUserStore()

// Philippine-eligible project types (single source of truth)
const projectTypes = PROJECT_TYPES
const selectedTypeDescription = computed(
  () => PROJECT_TYPES.find((type) => type.value === formData.value.category)?.description || '',
)

// Form data
const formData = ref({
  title: '',
  description: '',
  category: '',
  location: '',
  geo_coordinates: '',
  barangay: '',
  municipality: '',
  expected_impact: '',
  project_image: null, // Add project image field
  estimated_credits: '', // Add estimated credits field
  // credit_price is intentionally omitted — the verifier sets the price per
  // credit after reviewing the submitted project.
  start_date: '',
  end_date: '',
  host_entity: '',

  // Technical & compliance files (single-file inputs)
  pdd_file: null,
  baseline_file: null,
  additionality_file: null,
  leakage_file: null,
  safeguards_file: null,
  feasibility_file: null,

  lgu_endorsement_file: null,
  land_ownership_file: null,
  ecc_file: null,
  moa_file: null,

  // Financials (optional)
  capex: '',
  opex: '',
  carbon_yield_projection: '',
})

// File upload state
const uploadedFiles = ref([])
const fileUploadError = ref('')
const uploadingFiles = ref(false)

// Project image upload state
const projectImage = ref(null)
const projectImagePreview = ref('')
const projectImageError = ref('')
const uploadingImage = ref(false)
const isDraggingImage = ref(false)
const isDraggingFiles = ref(false)

// Form state
const loading = ref(false)
const errors = ref({})
const success = ref('')

// File input refs
const projectImageInput = ref(null)
const projectDocumentsInput = ref(null)
const pddInput = ref(null)
const baselineInput = ref(null)
const additionalityInput = ref(null)
const leakageInput = ref(null)
const safeguardsInput = ref(null)
const feasibilityInput = ref(null)

const lguEndorsementInput = ref(null)
const landOwnershipInput = ref(null)
const eccInput = ref(null)
const moaInput = ref(null)

// Categories are now custom text input - no longer using predefined list

// Form validation rules
const validationRules = {
  title: {
    required: true,
    minLength: 3,
    maxLength: 100,
    message: 'Title must be between 3 and 100 characters',
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 1000,
    message: 'Description must be between 10 and 1000 characters',
  },
  category: {
    required: true,
    minLength: 2,
    maxLength: 50,
    message: 'Category must be between 2 and 50 characters',
  },
  location: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Location must be between 2 and 100 characters',
  },
  geo_coordinates: {
    required: true,
    minLength: 3,
    maxLength: 100,
    message: 'Provide geo-coordinates (lat,lon) or a valid location string',
  },
  barangay: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Barangay is required',
  },
  municipality: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Municipality is required',
  },
  expected_impact: {
    required: true,
    minLength: 10,
    maxLength: 500,
    message: 'Expected impact must be between 10 and 500 characters',
  },
  start_date: {
    required: true,
    message: 'Start date is required',
  },
  end_date: {
    required: true,
    message: 'End date is required',
  },
  host_entity: {
    required: true,
    minLength: 2,
    maxLength: 200,
    message: 'Host entity is required',
  },
  estimated_credits: {
    required: true,
    min: 1,
    max: 1000000,
    message: 'Estimated credits must be between 1 and 1,000,000',
  },
}

// File upload configuration
const fileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  maxFiles: 5,
}

// Project image upload configuration
const imageUploadConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxWidth: 1920,
  maxHeight: 1080,
}

// Computed properties
const isEditMode = computed(() => props.mode === 'edit')
const formTitle = computed(() => (isEditMode.value ? 'Edit Project' : 'Create New Project'))
const submitButtonText = computed(() => {
  if (loading.value) {
    return isEditMode.value ? 'Updating...' : 'Creating...'
  }
  return isEditMode.value ? 'Update Project' : 'Create Project'
})

const isFormValid = computed(() => {
  const validationResults = {}
  const isValid = Object.keys(validationRules).every((field) => {
    const value = formData.value[field]
    const rule = validationRules[field]

    // Handle required validation - check for empty values (string, number, null, undefined)
    if (rule.required) {
      // Check for null, undefined, empty string, or NaN
      if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
        validationResults[field] = { valid: false, reason: 'required field is empty' }
        return false
      }
      // For strings, also check if trimmed value is empty
      if (typeof value === 'string' && value.trim() === '') {
        validationResults[field] = { valid: false, reason: 'required string field is empty after trim' }
        return false
      }
      // For numbers, check if it's valid and meets minimum requirement
      if (typeof value === 'number' && !isNaN(value)) {
        // Also check if it's 0 or negative for fields that require positive values
        // But only if min is defined and > 0
        if (rule.min !== undefined && rule.min > 0 && value < rule.min) {
          validationResults[field] = { valid: false, reason: `number is below minimum ${rule.min}` }
          return false
        }
      }
    }

    // Handle string length validation (only for strings)
    if (typeof value === 'string' && value) {
      if (rule.minLength && value.length < rule.minLength) {
        validationResults[field] = { valid: false, reason: `string length ${value.length} is below minimum ${rule.minLength}` }
        return false
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        validationResults[field] = { valid: false, reason: `string length ${value.length} exceeds maximum ${rule.maxLength}` }
        return false
      }
    }

    // Handle numeric validation (for number fields)
    if (typeof value === 'number' && !isNaN(value)) {
      if (rule.min !== undefined && value < rule.min) {
        validationResults[field] = { valid: false, reason: `number ${value} is below minimum ${rule.min}` }
        return false
      }
      if (rule.max !== undefined && value > rule.max) {
        validationResults[field] = { valid: false, reason: `number ${value} exceeds maximum ${rule.max}` }
        return false
      }
    }

    validationResults[field] = { valid: true }
    return true
  })
  
  // Log validation results for debugging
  if (!isValid) {
    console.log('[ERROR] Form validation failed. Field status:', JSON.parse(JSON.stringify(validationResults)))
    console.log('[DEBUG] Current form data:', JSON.parse(JSON.stringify({
      title: formData.value.title,
      description: formData.value.description,
      category: formData.value.category,
      location: formData.value.location,
      expected_impact: formData.value.expected_impact,
      estimated_credits: formData.value.estimated_credits,
      project_image: formData.value.project_image ? 'File uploaded' : null
    })))
    
    // Log which fields are failing
    Object.keys(validationResults).forEach(field => {
      if (!validationResults[field].valid) {
        console.log(`  [ERROR] ${field}: ${validationResults[field].reason}`)
      }
    })
  }
  
  return isValid
})

// Methods
function clearFieldError(field) {
  if (errors.value[field]) {
    delete errors.value[field]
  }
  if (Object.keys(errors.value).length === 0) {
    errors.value = {}
  }
  if (errors.value.general) {
    delete errors.value.general
  }
  success.value = ''
}

function validateField(field) {
  const value = formData.value[field]
  const rule = validationRules[field]

  // Handle required validation
  if (rule.required) {
    if (value === null || value === undefined || value === '') {
      errors.value[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`
      return false
    }
    // For strings, also check if trimmed value is empty
    if (typeof value === 'string' && value.trim() === '') {
      errors.value[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`
      return false
    }
    // For numbers, check if it's a valid number (not NaN)
    if (typeof value === 'number' && isNaN(value)) {
      errors.value[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`
      return false
    }
  }

  // Category must be one of the predefined Philippine-eligible project types
  if (field === 'category' && value && !isValidProjectType(value)) {
    errors.value[field] = 'Please select a valid Philippine-eligible project type'
    return false
  }

  // Handle string length validation (only for strings)
  if (typeof value === 'string' && value) {
    if (rule.minLength && value.length < rule.minLength) {
      errors.value[field] = rule.message
      return false
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      errors.value[field] = rule.message
      return false
    }
  }

  // Handle numeric validation (for number fields)
  if (typeof value === 'number' && !isNaN(value)) {
    if (rule.min !== undefined && value < rule.min) {
      errors.value[field] = rule.message
      return false
    }
    if (rule.max !== undefined && value > rule.max) {
      errors.value[field] = rule.message
      return false
    }
  }

  // Clear error if validation passes
  delete errors.value[field]
  return true
}

function validateForm() {
  let isValid = true

  Object.keys(validationRules).forEach((field) => {
    if (!validateField(field)) {
      isValid = false
    }
  })

  // Debug: Log form validation status
  console.log('Form validation status:', {
    isValid,
    formData: formData.value,
    errors: errors.value,
    isFormValid: isFormValid.value,
  })

  return isValid
}

function clearErrors() {
  errors.value = {}
  success.value = ''
}

function resetForm() {
  formData.value = {
    title: '',
    description: '',
    category: '',
    location: '',
    expected_impact: '',
    project_image: null,
    estimated_credits: '',
  }
  uploadedFiles.value = []
  fileUploadError.value = ''
  projectImage.value = null
  projectImagePreview.value = ''
  projectImageError.value = ''
  clearErrors()
}

// File upload methods
function validateFile(file) {
  // Check file size
  if (file.size > fileUploadConfig.maxFileSize) {
    return `File "${file.name}" is too large. Maximum size is ${fileUploadConfig.maxFileSize / 1024 / 1024}MB`
  }

  // Check file type
  if (!fileUploadConfig.allowedTypes.includes(file.type)) {
    return `File "${file.name}" format is not supported. Allowed formats: PDF, JPEG, PNG, DOC, DOCX`
  }

  return null
}

async function addFiles(files) {
  const incomingFiles = Array.from(files)
  fileUploadError.value = ''

  // Check max files limit
  if (uploadedFiles.value.length + incomingFiles.length > fileUploadConfig.maxFiles) {
    fileUploadError.value = `Maximum ${fileUploadConfig.maxFiles} files allowed`
    return
  }

  uploadingFiles.value = true

  for (const file of incomingFiles) {
    const validationError = validateFile(file)
    if (validationError) {
      fileUploadError.value = validationError
      continue
    }

    try {
      // In a real implementation, you would upload to a file storage service
      // For now, we'll store the file object locally
      const fileData = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
        uploadDate: new Date().toISOString(),
        url: URL.createObjectURL(file), // Temporary URL for preview
      }

      uploadedFiles.value.push(fileData)
    } catch (error) {
      console.error('Error uploading file:', error)
      fileUploadError.value = `Failed to upload ${file.name}`
    }
  }

  uploadingFiles.value = false
}

async function handleFileUpload(event) {
  await addFiles(event.target.files || [])
  event.target.value = ''
}

function removeFile(fileId) {
  const index = uploadedFiles.value.findIndex((f) => f.id === fileId)
  if (index !== -1) {
    // Revoke the object URL to free memory
    URL.revokeObjectURL(uploadedFiles.value[index].url)
    uploadedFiles.value.splice(index, 1)
  }
}

// Project image upload methods
function validateImageFile(file) {
  // Check file size
  if (file.size > imageUploadConfig.maxFileSize) {
    return `Image "${file.name}" is too large. Maximum size is ${imageUploadConfig.maxFileSize / 1024 / 1024}MB`
  }

  // Check file type
  if (!imageUploadConfig.allowedTypes.includes(file.type)) {
    return `Image "${file.name}" format is not supported. Allowed formats: JPEG, PNG, WebP`
  }

  return null
}

// Generic single-document handler used for required technical/compliance docs
async function handleSingleDocUpload(event, fieldName) {
  const file = event.target.files?.[0]
  if (!file) return

  const validationError = validateFile(file)
  if (validationError) {
    fileUploadError.value = validationError
    return
  }

  formData.value[fieldName] = file
  // clear input value to allow re-upload
  event.target.value = ''
}

async function processProjectImageFile(file) {
  projectImageError.value = ''
  uploadingImage.value = true

  try {
    const validationError = validateImageFile(file)
    if (validationError) {
      projectImageError.value = validationError
      return
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    projectImagePreview.value = previewUrl
    projectImage.value = file
    formData.value.project_image = file

    console.log('Project image uploaded:', file.name)
  } catch (error) {
    console.error('Error uploading project image:', error)
    projectImageError.value = `Failed to upload ${file.name}`
  } finally {
    uploadingImage.value = false
  }
}

async function handleProjectImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  await processProjectImageFile(file)
  event.target.value = ''
}

function removeProjectImage() {
  if (projectImagePreview.value) {
    URL.revokeObjectURL(projectImagePreview.value)
  }
  projectImage.value = null
  projectImagePreview.value = ''
  formData.value.project_image = null
  projectImageError.value = ''
}

async function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function triggerProjectImageSelect() {
  projectImageInput.value?.click()
}

function triggerDocumentsSelect() {
  projectDocumentsInput.value?.click()
}

function handleImageDragOver(event) {
  event.preventDefault()
  isDraggingImage.value = true
}

function handleImageDragLeave(event) {
  event.preventDefault()
  isDraggingImage.value = false
}

async function handleImageDrop(event) {
  event.preventDefault()
  isDraggingImage.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    await processProjectImageFile(file)
  }
}

function onImageZoneClick(event) {
  if (uploadingImage.value) return
  // Ignore clicks on remove button
  if (event.target.closest('.remove-image-btn')) {
    return
  }
  triggerProjectImageSelect()
}

function handleFileDragOver(event) {
  event.preventDefault()
  isDraggingFiles.value = true
}

function handleFileDragLeave(event) {
  event.preventDefault()
  isDraggingFiles.value = false
}

async function handleFileDrop(event) {
  event.preventDefault()
  isDraggingFiles.value = false
  const files = event.dataTransfer?.files
  if (files && files.length) {
    await addFiles(files)
  }
}

function onFileZoneClick(event) {
  if (uploadingFiles.value) return
  if (event.target.closest('.remove-file')) {
    return
  }
  triggerDocumentsSelect()
}

async function handleSubmit() {
  console.log('[DEBUG] Form submit button clicked!')
  console.log('[DEBUG] Form data:', formData.value)
  console.log('[OK] isFormValid:', isFormValid.value)
  
  clearErrors()

  // Log validation status
  const validationResult = validateForm()
  console.log('[DEBUG] validateForm() result:', validationResult)
  console.log('[ERROR] Current errors:', errors.value)
  
  if (!validationResult) {
    console.warn('[WARN] Form validation failed, preventing submission')
    return
  }

  if (!isFormValid.value) {
    console.warn('[WARN] isFormValid is false, preventing submission')
    // Log which fields are failing validation
    Object.keys(validationRules).forEach((field) => {
      const value = formData.value[field]
      const rule = validationRules[field]
      console.log(`  - ${field}:`, {
        value,
        type: typeof value,
        required: rule.required,
        hasValue: value !== null && value !== undefined && value !== '',
        isString: typeof value === 'string',
        isNumber: typeof value === 'number',
        stringLength: typeof value === 'string' ? value.length : 'N/A',
        passesRequired: !rule.required || (value !== null && value !== undefined && value !== '' && (typeof value !== 'string' || value.trim() !== '') && (typeof value !== 'number' || !isNaN(value))),
      })
    })
    return
  }
  
  console.log('[OK] All validations passed, proceeding with submission...')

  loading.value = true

  try {
    // Prepare project data with scalar fields; files will be serialized below
    const projectData = {
      title: formData.value.title,
      description: formData.value.description,
      category: formData.value.category,
      location: formData.value.location,
      geo_coordinates: formData.value.geo_coordinates,
      barangay: formData.value.barangay,
      municipality: formData.value.municipality,
      expected_impact: formData.value.expected_impact,
      start_date: formData.value.start_date,
      end_date: formData.value.end_date,
      host_entity: formData.value.host_entity,
      estimated_credits: formData.value.estimated_credits,
      capex: formData.value.capex,
      opex: formData.value.opex,
      carbon_yield_projection: formData.value.carbon_yield_projection,
      status: isEditMode.value ? (props.project && props.project.status ? props.project.status : 'draft') : 'submitted',
      documents: [],
    }

    // Attach technical & compliance documents with simple metadata
    const addIfFile = (file, label) => {
      if (file) {
        projectData.documents.push({
          name: file.name,
          size: file.size,
          type: file.type,
          label,
          uploadDate: new Date().toISOString(),
        })
      }
    }

    addIfFile(formData.value.pdd_file, 'pdd')
    addIfFile(formData.value.baseline_file, 'baseline')
    addIfFile(formData.value.additionality_file, 'additionality')
    addIfFile(formData.value.leakage_file, 'leakage')
    addIfFile(formData.value.safeguards_file, 'safeguards')
    addIfFile(formData.value.feasibility_file, 'feasibility')
    addIfFile(formData.value.lgu_endorsement_file, 'lgu_endorsement')
    addIfFile(formData.value.land_ownership_file, 'land_ownership')
    addIfFile(formData.value.ecc_file, 'ecc')
    addIfFile(formData.value.moa_file, 'moa')

    // Include any generic uploaded files as well
    uploadedFiles.value.forEach((file) => {
      projectData.documents.push({
        name: file.name,
        size: file.size,
        type: file.type,
        label: 'other',
        uploadDate: file.uploadDate,
      })
    })

    // Convert project image to base64 for database storage
    if (projectImage.value) {
      try {
        const imageBase64 = await convertImageToBase64(projectImage.value)
        projectData.project_image = imageBase64
        projectData.image_name = projectImage.value.name
        projectData.image_type = projectImage.value.type
        projectData.image_size = projectImage.value.size
      } catch (error) {
        console.error('Error converting image to base64:', error)
        errors.value.general = 'Failed to process project image'
        return
      }
    }

    if (isEditMode.value) {
      // Update existing project
      await projectService.updateProject(props.project.id, projectData)
      success.value = 'Project updated successfully!'
    } else {
      // Submit new project - try multiple methods for reliability
      let submittedProject = null

      // Get user ID from Supabase (most reliable source)
      let userId = null
      const supabase = (await import('@/services/supabaseClient')).getSupabase()

      if (!supabase) {
        throw new Error('Supabase client not available')
      }

      // Method 1: Try getUser() first (most reliable)
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (user && !userError) {
          userId = user.id
          console.log('[OK] Using user ID from Supabase getUser():', userId)
        } else {
          console.log('getUser() failed:', userError)
        }
      } catch (error) {
        console.log('getUser() error:', error)
      }

      // Method 2: Try getSession() if getUser() failed
      if (!userId) {
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession()
          if (session?.user && !sessionError) {
            userId = session.user.id
            console.log('[OK] Using user ID from Supabase getSession():', userId)
          } else {
            console.log('getSession() failed:', sessionError)
          }
        } catch (error) {
          console.log('getSession() error:', error)
        }
      }

      // Method 3: Try userStore session as fallback
      if (!userId && userStore.session?.user?.id) {
        userId = userStore.session.user.id
        console.log('[OK] Using user ID from userStore session:', userId)
      }

      // If we still don't have a user ID, throw an error
      if (!userId) {
        throw new Error('Unable to get user ID. Please log in again and try submitting the project.')
      }

      console.log('[OK] Final user ID to use for project submission:', userId)

      // Verify the profile exists before submitting
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single()

        if (profileError || !profile) {
          console.error('[ERROR] Profile not found for user ID:', userId, profileError)
          throw new Error(
            'Your user profile was not found. Please contact support or try logging out and logging back in.'
          )
        }
        console.log('[OK] Profile verified for user ID:', userId)
      } catch (profileCheckError) {
        if (profileCheckError.message.includes('profile was not found')) {
          throw profileCheckError
        }
        console.warn('[WARN] Could not verify profile, but continuing with submission:', profileCheckError)
      }

      try {
        // Try the workflow service first
        submittedProject = await projectWorkflowService.submitProject(projectData, userId)
        console.log('[OK] Project submitted via workflow service:', submittedProject)
      } catch (workflowError) {
        console.error('[ERROR] Workflow service failed:', workflowError)
        console.log('Trying direct submission as fallback...')

        // Fallback to direct project service
        try {
          submittedProject = await projectService.createProject(projectData, userId)
          console.log('[OK] Project submitted via direct service:', submittedProject)
        } catch (directError) {
          console.error('[ERROR] Direct service failed:', directError)
          console.log('Trying approval service as final fallback...')

          // Final fallback to approval service
          try {
            submittedProject = await projectApprovalService.submitProject(projectData, userId)
            console.log('[OK] Project submitted via approval service:', submittedProject)
          } catch (approvalError) {
            console.error('[ERROR] All submission methods failed:', {
              workflow: workflowError.message,
              direct: directError.message,
              approval: approvalError.message,
            })
            throw new Error(
              `Failed to submit project: ${approvalError.message || 'All submission methods failed. Please try again or contact support.'}`
            )
          }
        }
      }

      // Don't set success message here - let the parent component handle it
      // success.value = 'Project submitted successfully! It will be reviewed by our verification team.'
    }

    // Emit success event
    emit('success', projectData)

    // Reset form if creating new project
    if (!isEditMode.value) {
      resetForm()
    }
  } catch (error) {
    console.error('[ERROR] Error saving project:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    // Check if it's an auth error
    if (error.message && (error.message.includes('session') || error.message.includes('auth') || error.message.includes('unauthorized'))) {
      errors.value.general = 'Your session may have expired. Please refresh the page and try again.'
      console.warn('[WARN] Auth-related error detected during project submission')
    } else {
      errors.value.general = error.message || 'Failed to save project. Please try again.'
    }

    // Show more detailed error information
    if (error.message) {
      console.log('Detailed error:', error.message)
    }
  } finally {
    loading.value = false
  }
}

function handleCancel() {
  resetForm()
  emit('cancel')
}

// Initialize form with project data if editing
onMounted(() => {
  if (isEditMode.value && props.project) {
    formData.value = {
      title: props.project.title || '',
      description: props.project.description || '',
      category: props.project.category || '',
      location: props.project.location || '',
      expected_impact: props.project.expected_impact || '',
    }
  }
})
</script>

<template>
  <div class="project-form">
    <div class="form-header">
      <h2>{{ formTitle }}</h2>
      <p v-if="!isEditMode">
        Submit your environmental project for verification and potential funding.
      </p>
      <p v-else>Update your project details below.</p>
    </div>

    <form @submit.prevent="handleSubmit" class="form">
      <!-- General Error Message -->
      <div v-if="errors.general" class="error-message">
        {{ errors.general }}
      </div>

      <!-- Success Message -->
      <div v-if="success" class="success-message">
        {{ success }}
      </div>

      <div class="form-subsection">
        <div class="subsection-header">
          <h4 class="subsection-title">Project Details *</h4>
        </div>
        <div class="project-title-card">
          <label class="project-title-label" for="project-title">
            <span class="material-symbols-outlined credit-card-icon" aria-hidden="true">description</span>
            <span>Project Title *</span>
          </label>
          <UiInput
            id="project-title"
            type="text"
            placeholder="Enter a descriptive title for your project"
            v-model="formData.title"
            :error="errors.title"
            @input="clearFieldError('title')"
          />
          <div class="project-title-hint">
            <span class="material-symbols-outlined help-icon" aria-hidden="true">info</span>
            <span>{{ formData.title.length }}/100 characters</span>
          </div>
        </div>
      </div>

      <div class="form-subsection optional">
        <div class="subsection-header">
          <h4 class="subsection-title">Project Image (Optional)</h4>
        </div>
        <div
          class="upload-dropzone"
          :class="{ dragging: isDraggingImage }"
          @dragover.prevent="handleImageDragOver"
          @dragleave.prevent="handleImageDragLeave"
          @drop.prevent="handleImageDrop"
          @click="onImageZoneClick"
        >
          <input
            ref="projectImageInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="file-input-hidden"
            @change="handleProjectImageUpload"
          />
          <div v-if="uploadingImage" class="upload-loading">
            <div class="loading-spinner"></div>
            <span>Uploading image...</span>
          </div>
          <template v-else>
            <div v-if="projectImagePreview" class="image-preview-container">
              <img :src="projectImagePreview" alt="Project preview" class="image-preview" />
              <button type="button" class="remove-image-btn" @click.stop="removeProjectImage">
                <span class="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
            <div v-else class="upload-placeholder">
              <span class="material-symbols-outlined upload-icon" aria-hidden="true">add_photo_alternate</span>
              <p class="upload-title">Click to upload project image</p>
              <p class="upload-subtitle">or drag and drop image here</p>
              <p class="upload-hint">JPEG, PNG, WebP up to 5MB</p>
            </div>
          </template>
        </div>
      </div>

      <!-- Project Category -->
      <div class="form-group">
        <label for="category" class="form-label"> Project Type * </label>
        <select
          id="category"
          v-model="formData.category"
          :class="['form-select', { error: errors.category }]"
          @blur="validateField('category')"
          @change="clearErrors"
        >
          <option value="" disabled>Select a Philippine-eligible project type</option>
          <option v-for="type in projectTypes" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
        </select>
        <div v-if="errors.category" class="field-error">
          {{ errors.category }}
        </div>
        <div class="field-help">
          {{ selectedTypeDescription || 'Choose the DENR/CCC-aligned category that best fits your project.' }}
        </div>
      </div>

      <!-- Project Location -->
      <div class="form-group">
        <label for="location" class="form-label"> Project Location * </label>
        <UiInput
          id="location"
          v-model="formData.location"
          :class="{ error: errors.location }"
          placeholder="City, Province, Country"
          @blur="validateField('location')"
          @input="clearErrors"
        />
        <div v-if="errors.location" class="field-error">
          {{ errors.location }}
        </div>
        <div class="field-help">{{ formData.location.length }}/100 characters</div>
      </div>

      <!-- Project Description -->
      <div class="form-group">
        <label for="description" class="form-label"> Project Description * </label>
        <textarea
          id="description"
          v-model="formData.description"
          :class="['form-textarea', { error: errors.description }]"
          placeholder="Describe your project in detail. Include objectives, methodology, timeline, and expected outcomes."
          rows="5"
          @blur="validateField('description')"
          @input="clearErrors"
        ></textarea>
        <div v-if="errors.description" class="field-error">
          {{ errors.description }}
        </div>
        <div class="field-help">{{ formData.description.length }}/1000 characters</div>
      </div>

      <!-- Expected Impact -->
      <div class="form-group">
        <label for="expected_impact" class="form-label"> Expected Impact * </label>
        <textarea
          id="expected_impact"
          v-model="formData.expected_impact"
          :class="['form-textarea', { error: errors.expected_impact }]"
          placeholder="Describe the environmental, social, or economic impact your project will have. Include measurable outcomes if possible."
          rows="4"
          @blur="validateField('expected_impact')"
          @input="clearErrors"
        ></textarea>
        <div v-if="errors.expected_impact" class="field-error">
          {{ errors.expected_impact }}
        </div>
        <div class="field-help">{{ formData.expected_impact.length }}/500 characters</div>
      </div>

        <div class="form-subsection">
          <div class="subsection-header">
            <h4 class="subsection-title">Project Location Details *</h4>
          </div>
          <div class="form-group">
            <label for="geo_coordinates" class="form-label"> Geo-coordinates (lat,lon) * </label>
            <UiInput
              id="geo_coordinates"
              v-model="formData.geo_coordinates"
              :class="{ error: errors.geo_coordinates }"
              placeholder="e.g., 14.5995,120.9842"
              @blur="validateField('geo_coordinates')"
              @input="clearErrors"
            />
            <div v-if="errors.geo_coordinates" class="field-error">{{ errors.geo_coordinates }}</div>
          </div>

          <div class="form-group">
            <label for="barangay" class="form-label"> Barangay * </label>
            <UiInput id="barangay" v-model="formData.barangay" :class="{ error: errors.barangay }" @blur="validateField('barangay')" />
            <div v-if="errors.barangay" class="field-error">{{ errors.barangay }}</div>
          </div>

          <div class="form-group">
            <label for="municipality" class="form-label"> Municipality / City * </label>
            <UiInput id="municipality" v-model="formData.municipality" :class="{ error: errors.municipality }" @blur="validateField('municipality')" />
            <div v-if="errors.municipality" class="field-error">{{ errors.municipality }}</div>
          </div>

          <div class="form-grid two-columns">
            <div class="form-group">
              <label for="start_date" class="form-label"> Start Date * </label>
              <UiInput id="start_date" type="date" v-model="formData.start_date" :class="{ error: errors.start_date }" @blur="validateField('start_date')" />
              <div v-if="errors.start_date" class="field-error">{{ errors.start_date }}</div>
            </div>
            <div class="form-group">
              <label for="end_date" class="form-label"> End Date * </label>
              <UiInput id="end_date" type="date" v-model="formData.end_date" :class="{ error: errors.end_date }" @blur="validateField('end_date')" />
              <div v-if="errors.end_date" class="field-error">{{ errors.end_date }}</div>
            </div>
          </div>

          <div class="form-group">
            <label for="host_entity" class="form-label"> Host Entity (LGU / Private / Coop) * </label>
            <UiInput id="host_entity" v-model="formData.host_entity" :class="{ error: errors.host_entity }" @blur="validateField('host_entity')" />
            <div v-if="errors.host_entity" class="field-error">{{ errors.host_entity }}</div>
          </div>
        </div>

        <div class="form-subsection optional">
          <div class="subsection-header">
            <h4 class="subsection-title">Required Technical & Compliance Documents</h4>
            <p class="subsection-subtitle">Upload each required document as its own file input.</p>
          </div>

          <div class="document-grid">
            <div class="doc-row">
              <label>PDD *</label>
              <input ref="pddInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'pdd_file')" />
              <div class="doc-meta">{{ formData.pdd_file ? formData.pdd_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>Baseline Report *</label>
              <input ref="baselineInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'baseline_file')" />
              <div class="doc-meta">{{ formData.baseline_file ? formData.baseline_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>Additionality Justification *</label>
              <input ref="additionalityInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'additionality_file')" />
              <div class="doc-meta">{{ formData.additionality_file ? formData.additionality_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>Leakage Assessment *</label>
              <input ref="leakageInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'leakage_file')" />
              <div class="doc-meta">{{ formData.leakage_file ? formData.leakage_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>Safeguards Checklist *</label>
              <input ref="safeguardsInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'safeguards_file')" />
              <div class="doc-meta">{{ formData.safeguards_file ? formData.safeguards_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>Feasibility Study (Optional)</label>
              <input ref="feasibilityInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'feasibility_file')" />
              <div class="doc-meta">{{ formData.feasibility_file ? formData.feasibility_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>LGU Endorsement *</label>
              <input ref="lguEndorsementInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'lgu_endorsement_file')" />
              <div class="doc-meta">{{ formData.lgu_endorsement_file ? formData.lgu_endorsement_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>Land Ownership / Lease Documents *</label>
              <input ref="landOwnershipInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'land_ownership_file')" />
              <div class="doc-meta">{{ formData.land_ownership_file ? formData.land_ownership_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>ECC / Permits *</label>
              <input ref="eccInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'ecc_file')" />
              <div class="doc-meta">{{ formData.ecc_file ? formData.ecc_file.name : 'No file selected' }}</div>
            </div>

            <div class="doc-row">
              <label>MOA / Agreements *</label>
              <input ref="moaInput" type="file" accept="application/pdf" class="file-input-hidden" @change="(e) => handleSingleDocUpload(e, 'moa_file')" />
              <div class="doc-meta">{{ formData.moa_file ? formData.moa_file.name : 'No file selected' }}</div>
            </div>
          </div>
        </div>

      <div class="form-subsection">
        <div class="subsection-header">
          <h4 class="subsection-title">Credit Information *</h4>
        </div>
        <div class="credit-grid">
          <div class="credit-card">
            <div class="credit-card-header">
              <span class="material-symbols-outlined credit-card-icon" aria-hidden="true">insights</span>
              <span class="credit-card-title">Estimated Credits *</span>
            </div>
            <div class="credit-field">
              <div class="prefix">#</div>
              <UiInput
                type="number"
                min="1"
                step="1"
                v-model.number="formData.estimated_credits"
                placeholder="0"
                :error="errors.estimated_credits"
                @input="clearFieldError('estimated_credits')"
              />
              <div class="field-hint">Min: 1</div>
            </div>
            <div class="help-card">
              <span class="material-symbols-outlined help-icon" aria-hidden="true">lightbulb</span>
              <span>Number of carbon credits this project will generate</span>
            </div>
          </div>

          <div class="credit-card credit-card--note">
            <div class="credit-card-header">
              <span class="material-symbols-outlined credit-card-icon" aria-hidden="true">verified_user</span>
              <span class="credit-card-title">Price per Credit</span>
            </div>
            <div class="help-card">
              <span class="material-symbols-outlined help-icon" aria-hidden="true">info</span>
              <span>The price per carbon credit is set by the verifier after they review and validate your project.</span>
            </div>
          </div>
        </div>
      </div>

      <div class="form-subsection optional">
        <div class="subsection-header">
          <h4 class="subsection-title">Project Documents (Optional)</h4>
        </div>
        <div
          class="upload-dropzone"
          :class="{ dragging: isDraggingFiles }"
          @dragover.prevent="handleFileDragOver"
          @dragleave.prevent="handleFileDragLeave"
          @drop.prevent="handleFileDrop"
          @click="onFileZoneClick"
        >
          <input
            ref="projectDocumentsInput"
            type="file"
            multiple
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
            class="file-input-hidden"
            @change="handleFileUpload"
          />
          <div v-if="uploadingFiles" class="upload-loading">
            <div class="loading-spinner"></div>
            <span>Uploading documents...</span>
          </div>
          <template v-else>
            <div v-if="uploadedFiles.length" class="uploaded-files">
              <div v-for="file in uploadedFiles" :key="file.id || file.name" class="uploaded-file">
                <span class="material-symbols-outlined document-icon" aria-hidden="true">
                  {{ file.type.includes('pdf') ? 'picture_as_pdf' : file.type.includes('image') ? 'image' : 'description' }}
                </span>
                <span class="file-name">{{ file.name }}</span>
                <button type="button" class="remove-file" @click.stop="removeFile(file.id || file.name)">
                  <span class="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
            </div>
            <div v-else class="upload-placeholder">
              <span class="material-symbols-outlined upload-icon" aria-hidden="true">folder</span>
              <p class="upload-title">Click to upload documents</p>
              <p class="upload-subtitle">or drag and drop files here</p>
              <p class="upload-hint">PDF, DOC, DOCX, JPEG, PNG up to 10MB each (max 5 files)</p>
            </div>
          </template>
          <div v-if="fileUploadError" class="upload-error">{{ fileUploadError }}</div>
        </div>
      </div>

      <!-- Form Actions -->
      <div class="form-actions">
        <UiButton type="button" variant="outline" @click="handleCancel" :disabled="loading">
          Cancel
        </UiButton>
        <UiButton type="submit" :disabled="loading || !isFormValid">
          {{ submitButtonText }}
        </UiButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.project-form {
  max-width: 100%;
  margin: 0;
  padding: 0;
  background: var(--bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 200px);
  border-radius: 1rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-light, #e8f5e8);
  overflow: hidden;
  position: relative;
}

.project-form::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary-color, #069e2d), var(--primary-hover, #058e3f), var(--primary-color, #069e2d));
  background-size: 200% 100%;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.form-header {
  padding: 32px 32px 0 32px;
  margin-bottom: 0;
  text-align: center;
  background: var(--bg-primary, #ffffff);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  flex-shrink: 0;
}

.form-header h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary, #1a202c);
}

.form-header p {
  margin: 0 0 24px 0;
  color: var(--text-secondary, #4a5568);
  font-size: 16px;
}

.form {
  background: var(--bg-primary, #ffffff);
  border: none;
  border-radius: 0;
  padding: 32px;
  box-shadow: none;
  flex: 1;
  overflow-y: auto;
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.form-group {
  margin-bottom: 24px;
}

.form-spacer {
  flex: 1;
  min-height: 2rem;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-primary, #1a202c);
  font-size: 16px;
}

.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border-color, #d1e7dd);
  border-radius: var(--radius-md, 0.5rem);
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #1a202c);
  font-size: 16px;
  transition: all 0.2s ease;
}

.form-select:focus {
  outline: none;
  border-color: var(--primary-color, #069e2d);
  box-shadow: 0 0 0 3px var(--primary-light, rgba(6, 158, 45, 0.1));
}

.form-select.error {
  border-color: var(--carbonify-error);
}

.form-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border-color, #d1e7dd);
  border-radius: var(--radius-md, 0.5rem);
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #1a202c);
  font-size: 16px;
  font-family: inherit;
  resize: none;
  min-height: 120px;
  transition: all 0.2s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--primary-color, #069e2d);
  box-shadow: 0 0 0 3px var(--primary-light, rgba(6, 158, 45, 0.1));
}

.form-textarea.error {
  border-color: var(--carbonify-error);
}

.field-error {
  margin-top: 4px;
  color: var(--carbonify-error);
  font-size: 12px;
  font-weight: 500;
}

.field-help {
  margin-top: 4px;
  color: var(--text-muted, #718096);
  font-size: 12px;
  font-weight: 500;
}

.error-message {
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
  padding: 12px 16px;
  border-radius: var(--radius);
  margin-bottom: 20px;
  font-size: 14px;
}

.success-message {
  background: var(--carbonify-success-bg);
  color: var(--carbonify-success);
  padding: 12px 16px;
  border-radius: var(--radius);
  margin-bottom: 20px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: auto;
  padding: 24px 32px 32px 32px;
  border-top: 2px solid var(--border-light, #e8f5e8);
  background: linear-gradient(to bottom, var(--bg-primary, #ffffff), var(--bg-secondary, #f8fdf8));
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  z-index: 10;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
}

/* Custom Scrollbar */
.form::-webkit-scrollbar {
  width: 8px;
}

.form::-webkit-scrollbar-track {
  background: var(--bg-secondary, #f8fdf8);
  border-radius: 4px;
}

.form::-webkit-scrollbar-thumb {
  background: var(--primary-color, #069e2d);
  border-radius: 4px;
}

.form::-webkit-scrollbar-thumb:hover {
  background: var(--primary-hover, #058e3f);
}

/* File Upload Styles */
.file-upload-section {
  margin-top: 8px;
}

.file-upload-area {
  position: relative;
  border: 2px dashed var(--border-color, #d1e7dd);
  border-radius: var(--radius-md, 0.5rem);
  padding: 32px 16px;
  text-align: center;
  background: var(--bg-secondary, #f8fdf8);
  transition: all 0.2s ease;
  cursor: pointer;
}

.file-upload-area:hover {
  border-color: var(--primary-color, #069e2d);
  background: var(--primary-light, rgba(6, 158, 45, 0.05));
}

.file-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.file-upload-label {
  cursor: pointer;
  display: block;
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.upload-text {
  margin-bottom: 8px;
}

.upload-text strong {
  display: block;
  color: var(--text-primary, #1a202c);
  margin-bottom: 4px;
}

.upload-text span {
  color: var(--text-secondary, #4a5568);
  font-size: 14px;
}

.upload-restrictions {
  font-size: 12px;
  color: var(--text-muted, #718096);
}

.file-upload-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.upload-progress {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: var(--radius-sm);
  font-size: 14px;
  text-align: center;
}

.uploaded-files {
  margin-top: 16px;
}

.uploaded-files h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 600;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.file-size {
  font-size: 12px;
  color: var(--text-muted);
}

.remove-file-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-size: 16px;
  line-height: 1;
}

.remove-file-btn:hover {
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
}

.remove-file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Project Image Upload Styles */
.project-image-upload-section {
  margin-top: 8px;
}

.image-preview-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 360px;
  max-height: 240px;
  margin: 0 auto;
  border-radius: var(--radius-md, 0.5rem);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: white;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.remove-image-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
}

.remove-image-btn:hover {
  background: rgba(220, 38, 38, 0.9);
}

.remove-image-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.image-upload-area {
  position: relative;
  border: 2px dashed var(--border-color, #d1e7dd);
  border-radius: var(--radius-md, 0.5rem);
  padding: 24px 16px;
  text-align: center;
  background: var(--bg-secondary, #f8fdf8);
  transition: all 0.2s ease;
  cursor: pointer;
}

.image-upload-area:hover {
  border-color: var(--primary-color, #069e2d);
  background: var(--primary-light, rgba(6, 158, 45, 0.05));
}

.image-input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.image-upload-label {
  cursor: pointer;
  display: block;
}

.image-upload-label .upload-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.image-upload-label .upload-text {
  margin-bottom: 6px;
}

.image-upload-label .upload-text strong {
  display: block;
  color: var(--text-primary, #1a202c);
  margin-bottom: 2px;
  font-size: 14px;
}

.image-upload-label .upload-text span {
  color: var(--text-secondary, #4a5568);
  font-size: 12px;
}

.image-upload-label .upload-restrictions {
  font-size: 11px;
  color: var(--text-muted, #718096);
}

.image-upload-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
  border-radius: var(--radius-sm);
  font-size: 14px;
}

/* Credit Information Styles */
.credit-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 8px;
}

.credit-field {
  display: flex;
  flex-direction: column;
}

.price-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.price-input-container-enhanced {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-secondary, #f8fdf8);
  border: 2px solid var(--border-light, #e8f5e8);
  border-radius: var(--radius-md, 0.625rem);
  padding: 0.5rem;
  transition: all 0.3s ease;
}

.price-input-container-enhanced:focus-within {
  border-color: var(--primary-color, #069e2d);
  background: var(--bg-primary, #ffffff);
  box-shadow: 0 0 0 4px var(--primary-light, rgba(6, 158, 45, 0.1));
}

.currency-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, var(--primary-color, #069e2d), var(--primary-hover, #058e3f));
  color: white;
  font-weight: 700;
  font-size: 1.125rem;
  border-radius: var(--radius-sm, 0.5rem);
  box-shadow: 0 2px 6px rgba(6, 158, 45, 0.2);
  flex-shrink: 0;
}

.price-helper {
  display: flex;
  align-items: center;
  margin-left: auto;
  padding-right: 0.5rem;
}

.helper-text {
  font-size: 0.75rem;
  color: var(--text-muted, #718096);
  font-weight: 500;
}

.price-field-enhanced {
  background: linear-gradient(135deg, var(--bg-secondary, #f8fdf8) 0%, var(--bg-primary, #ffffff) 100%);
  border-radius: var(--radius-md, 0.625rem);
  padding: 1.25rem;
  border: 2px solid var(--border-light, #e8f5e8);
  transition: all 0.3s ease;
}

.price-field-enhanced:hover {
  border-color: var(--primary-color, #069e2d);
  box-shadow: 0 2px 8px rgba(6, 158, 45, 0.1);
}

.price-label-enhanced {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.label-icon {
  font-size: 1.25rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.price-help-enhanced {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--primary-light, rgba(6, 158, 45, 0.05));
  border-radius: var(--radius-sm, 0.5rem);
  border-left: 3px solid var(--primary-color, #069e2d);
}

.help-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.credits-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, var(--primary-color, #069e2d), var(--primary-hover, #058e3f));
  color: white;
  font-weight: 700;
  font-size: 1.125rem;
  border-radius: var(--radius-sm, 0.5rem);
  box-shadow: 0 2px 6px rgba(6, 158, 45, 0.2);
  flex-shrink: 0;
}

.credits-field-enhanced {
  background: linear-gradient(135deg, var(--bg-secondary, #f8fdf8) 0%, var(--bg-primary, #ffffff) 100%);
  border-radius: var(--radius-md, 0.625rem);
  padding: 1.25rem;
  border: 2px solid var(--border-light, #e8f5e8);
  transition: all 0.3s ease;
}

.credits-field-enhanced:hover {
  border-color: var(--primary-color, #069e2d);
  box-shadow: 0 2px 8px rgba(6, 158, 45, 0.1);
}

.credits-input-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-secondary, #f8fdf8);
  border: 2px solid var(--border-light, #e8f5e8);
  border-radius: var(--radius-md, 0.625rem);
  padding: 0.5rem;
  transition: all 0.3s ease;
}

.credits-input-container:focus-within {
  border-color: var(--primary-color, #069e2d);
  background: var(--bg-primary, #ffffff);
  box-shadow: 0 0 0 4px var(--primary-light, rgba(6, 158, 45, 0.1));
}

.currency-symbol {
  position: absolute;
  left: 12px;
  color: var(--text-secondary, #4a5568);
  font-weight: 600;
  z-index: 1;
  pointer-events: none;
}

.price-input-container .form-input {
  padding-left: 24px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .form-header {
    padding: 24px 24px 0 24px;
  }

  .form {
    padding: 24px;
  }

  .form-actions {
    flex-direction: column;
    padding: 24px;
  }

  .form-actions button {
    width: 100%;
  }

  .image-preview {
    width: 150px;
    height: 112px;
  }

  .credit-info-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .price-input-container-enhanced {
    flex-wrap: wrap;
  }

  .price-helper {
    width: 100%;
    margin-left: 0;
    margin-top: 0.5rem;
  }
}

/* Enhanced Title Field Styles */
.title-field-enhanced {
  background: linear-gradient(135deg, var(--bg-secondary, #f8fdf8) 0%, var(--bg-primary, #ffffff) 100%);
  border-radius: var(--radius-md, 0.625rem);
  padding: 1.25rem;
  border: 2px solid var(--border-light, #e8f5e8);
  transition: all 0.3s ease;
}

.title-field-enhanced:hover {
  border-color: var(--primary-color, #069e2d);
  box-shadow: 0 2px 8px rgba(6, 158, 45, 0.1);
}

.title-label-enhanced {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.title-input-wrapper {
  position: relative;
}

.title-input-wrapper::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary-color, #069e2d), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.title-input-wrapper:focus-within::after {
  opacity: 1;
}

.title-help-enhanced {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #f8fdf8);
  border-radius: var(--radius-sm, 0.5rem);
  position: relative;
  overflow: hidden;
}

.char-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary-color, #069e2d), var(--primary-hover, #058e3f));
  transition: width 0.3s ease;
  opacity: 0.3;
}

.form-subsection {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.subsection-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.subsection-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #1a202c);
  margin-left: 8px;
}

.project-title-card {
  background: linear-gradient(135deg, var(--bg-secondary, #f8fdf8) 0%, var(--bg-primary, #ffffff) 100%);
  border-radius: var(--radius-md, 0.625rem);
  padding: 1.25rem;
  border: 2px solid var(--border-light, #e8f5e8);
  transition: all 0.3s ease;
}

.project-title-card:hover {
  border-color: var(--primary-color, #069e2d);
  box-shadow: 0 2px 8px rgba(6, 158, 45, 0.1);
}

.project-title-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  color: #1f2937;
}

.project-title-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(37, 99, 235, 0.08);
  color: #1d4ed8;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  margin-top: 0.75rem;
  font-size: 0.875rem;
}

.upload-dropzone {
  position: relative;
  border: 2px dashed var(--border-color, #d1e7dd);
  border-radius: var(--radius-md, 0.5rem);
  padding: 24px 16px;
  text-align: center;
  background: var(--bg-secondary, #f8fdf8);
  transition: all 0.2s ease;
  cursor: pointer;
  min-height: 150px; /* Ensure a minimum height for the dropzone */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.upload-dropzone:hover {
  border-color: var(--primary-color, #069e2d);
  background: var(--primary-light, rgba(6, 158, 45, 0.05));
}

.upload-dropzone.dragging {
  border-color: var(--primary-color, #069e2d);
  background: var(--primary-light, rgba(6, 158, 45, 0.1));
  box-shadow: 0 0 10px rgba(6, 158, 45, 0.2);
}

.upload-loading {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md, 0.5rem);
  z-index: 10;
}

.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--primary-color, #069e2d);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.upload-placeholder {
  text-align: center;
  padding: 2rem 1rem;
  color: #6b7280;
}

.upload-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin-bottom: 0.75rem;
  color: var(--primary-color, #069e2d);
}

.document-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--primary-color, #069e2d);
  margin-right: 0.75rem;
}

.remove-file {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.remove-file:hover {
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
}

.remove-file:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-input-hidden {
  display: none;
}

.credit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.credit-card {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid rgba(5, 150, 105, 0.12);
  box-shadow: 0 10px 30px rgba(6, 158, 45, 0.12);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.credit-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.credit-card-icon {
  font-size: 1.6rem;
  color: var(--primary-color, #069e2d);
}

.credit-card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.credit-field {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.75rem;
}

.credit-field .prefix {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.12);
  color: var(--primary-color, #069e2d);
  font-weight: 600;
}

.credit-field .ui-input {
  width: 100%;
}

.field-hint {
  grid-column: 1 / -1;
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: -0.25rem;
}

.help-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(16, 185, 129, 0.12);
  color: #04773b;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
  border: 1px solid rgba(5, 150, 105, 0.2);
}

.help-icon {
  font-size: 1.2rem;
  color: inherit;
}
</style>
