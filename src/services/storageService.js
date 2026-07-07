
/**
 * Storage service for handling file uploads to Supabase Storage
 */

/**
 * Upload a profile photo to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} userId - The user ID
 * @returns {Promise<string>} - The public URL of the uploaded image
 */
export async function uploadProfilePhoto(file, userId) {
  // Use async version to ensure Supabase is initialized
  const { getSupabaseAsync } = await import('@/services/supabaseClient')
  const supabase = await getSupabaseAsync()
  
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  if (!file) {
    throw new Error('No file provided')
  }

  if (!userId) {
    throw new Error('User ID is required')
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.')
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB in bytes
  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 5MB.')
  }

  try {
    // Ensure we have a valid session before uploading
    let { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !sessionData?.session) {
      console.error('No active session for storage upload:', sessionError)
      throw new Error('You must be logged in to upload profile photos. Please refresh the page and try again.')
    }

    // Verify the session user matches the userId
    if (sessionData.session.user.id !== userId) {
      throw new Error('User ID mismatch. Please refresh the page and try again.')
    }

    // Check if session is expired or close to expiring, refresh if needed
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = sessionData.session.expires_at || 0
    
    // If session expires in less than 60 seconds, try to refresh it
    if (expiresAt - now < 60) {
      console.log('Session expiring soon, refreshing...')
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError || !refreshData?.session) {
        console.warn('Could not refresh session, proceeding with existing session:', refreshError)
        // Continue with existing session - it might still work
      } else {
        sessionData = refreshData
        console.log('Session refreshed successfully')
      }
    }

    // Generate unique filename: userId_timestamp.extension
    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const fileName = `${userId}_${timestamp}.${fileExt}`
    // Don't include 'avatars/' prefix since the bucket is already named 'avatars'
    const filePath = fileName

    // Upload file to Supabase Storage
    const { error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      })

    if (error) {
      console.error('Error uploading file:', error)
      
      // Handle specific auth-related errors
      if (error.message?.includes('authorization') || error.message?.includes('Authorization')) {
        throw new Error('Authentication failed. Please refresh the page and try again.')
      }
      
      if (error.message?.includes('Bucket not found')) {
        throw new Error(
          'Storage bucket not found. Please create an "avatars" bucket in your Supabase project. See SUPABASE_SETUP.md for instructions.',
        )
      }
      
      if (error.message?.includes('JWT') || error.message?.includes('token')) {
        throw new Error('Session expired. Please refresh the page and try again.')
      }
      
      throw new Error(error.message || 'Failed to upload profile photo')
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(filePath)

    if (import.meta.env.DEV) {
      console.log('[DEV] Profile photo uploaded successfully:', publicUrl)
    }

    return publicUrl
  } catch (error) {
    console.error('Error in uploadProfilePhoto:', error)
    throw error
  }
}

/**
 * Upload a project compliance/technical document to Supabase Storage.
 *
 * Stores the file in the public `project-documents` bucket under a per-user,
 * per-project path and returns the permanent public URL. Used by the Submit /
 * Edit Project form so the required PDFs (PDD, baseline, additionality, LGU
 * endorsement, ECC, land title, MOA, …) are actually retrievable by verifiers,
 * admins, and buyers — previously only the filename was saved and every link
 * was dead.
 *
 * @param {File} file - The document file to upload
 * @param {string} userId - The uploading user's ID (namespaces the path)
 * @param {string} [label] - Optional document label (e.g. 'pdd', 'ecc')
 * @returns {Promise<string>} - The public URL of the uploaded document
 */
export async function uploadProjectDocument(file, userId, label = 'doc') {
  const { getSupabaseAsync } = await import('@/services/supabaseClient')
  const supabase = await getSupabaseAsync()

  if (!supabase) {
    throw new Error('Supabase client not available')
  }
  if (!file) {
    throw new Error('No file provided')
  }
  if (!userId) {
    throw new Error('You must be signed in to upload documents.')
  }

  // Validate type + size (mirror the bucket policy so failures surface early).
  const validTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (file.type && !validTypes.includes(file.type)) {
    throw new Error(`"${file.name}" is not an accepted document type (PDF, image, or Word).`)
  }
  const maxSize = 25 * 1024 * 1024 // 25MB — matches the bucket file_size_limit
  if (file.size > maxSize) {
    throw new Error(`"${file.name}" is too large. Maximum document size is 25MB.`)
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session) {
      throw new Error('Your session has expired. Please refresh the page and try again.')
    }

    // Build a safe, unique, namespaced path: userId/label_timestamp_slug.ext
    const dotIdx = file.name.lastIndexOf('.')
    const fileExt = dotIdx >= 0 ? file.name.slice(dotIdx + 1).toLowerCase() : 'bin'
    const safeLabel = String(label || 'doc').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'doc'
    const timestamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const filePath = `${userId}/${safeLabel}_${timestamp}_${rand}.${fileExt}`

    const { error } = await supabase.storage
      .from('project-documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })

    if (error) {
      console.error('Error uploading project document:', error)
      if (error.message?.includes('Bucket not found')) {
        throw new Error(
          'Document storage is not configured yet. Ask an admin to apply the project-documents bucket migration.',
        )
      }
      if (error.message?.includes('JWT') || error.message?.includes('token') || error.message?.includes('authorization')) {
        throw new Error('Your session has expired. Please refresh the page and try again.')
      }
      throw new Error(error.message || `Failed to upload "${file.name}".`)
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('project-documents').getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Error in uploadProjectDocument:', error)
    throw error
  }
}

/**
 * Delete a profile photo from Supabase Storage
 * @param {string} fileUrl - The URL of the file to delete
 * @param {string} userId - The user ID
 * @returns {Promise<void>}
 */
export async function deleteProfilePhoto(fileUrl) {
  // Use async version to ensure Supabase is initialized
  const { getSupabaseAsync } = await import('@/services/supabaseClient')
  const supabase = await getSupabaseAsync()
  
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  if (!fileUrl) {
    return // Nothing to delete
  }

  try {
    // Ensure we have a valid session before deleting
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !sessionData?.session) {
      console.warn('No active session for storage delete, but continuing...')
      // Don't throw - deletion failure shouldn't block the update
      return
    }
    // Extract file path from URL
    // URL format: https://[project-ref].supabase.co/storage/v1/object/public/avatars/[filename]
    const urlParts = fileUrl.split('/avatars/')
    if (urlParts.length !== 2) {
      console.warn('Invalid file URL format:', fileUrl)
      return
    }

    const fileName = urlParts[1]
    // Don't include 'avatars/' prefix since the bucket is already named 'avatars'
    const filePath = fileName

    // Delete file from Supabase Storage
    const { error } = await supabase.storage.from('avatars').remove([filePath])

    if (error) {
      console.error('Error deleting file:', error)
      // Don't throw - file might not exist or already deleted
      if (import.meta.env.DEV) {
        console.log('[DEV] Could not delete old profile photo:', error.message)
      }
    } else if (import.meta.env.DEV) {
      console.log('[DEV] Old profile photo deleted successfully')
    }
  } catch (error) {
    console.error('Error in deleteProfilePhoto:', error)
    // Don't throw - deletion failure shouldn't block the update
  }
}

/**
 * Resize and compress an image before upload
 * @param {File} file - The image file
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @param {number} quality - Image quality (0-1)
 * @returns {Promise<File>} - The resized file
 */
export async function resizeImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }

        // Create canvas and resize
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to resize image'))
              return
            }
            // Create new file with same name and type
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(resizedFile)
          },
          file.type,
          quality,
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
