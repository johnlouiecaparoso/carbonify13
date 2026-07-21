import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Design tokens first, so every component style resolves against them.
import '@/styles/tokens.css'
import '@/styles/responsive-table.css'

import App from './App.vue'
import router from './router'
import { analytics } from '@/utils/analytics'
import { initializeMobile } from '@/utils/mobile'
import { optimizeImageLoading } from '@/utils/imageOptimization'
import { setupServiceWorkerCache } from '@/utils/cache'
import { initSupabase } from '@/services/supabaseClient'
import { initSentry } from '@/utils/sentry'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Optional error tracking — dormant unless VITE_SENTRY_DSN is set (the SDK is
// only loaded when a DSN exists). Fire-and-forget so it never delays mount.
initSentry(app, router)

// Initialize Supabase client (errors handled internally)
initSupabase().catch(() => {
  // Error already logged in initSupabase, no need to log again
})

// Mount the app - Cache buster: 2024-10-02-V3-SINGLE-BOX-LOGIN
app.mount('#app')

// Gentle cache invalidation after app is mounted
if (typeof window !== 'undefined') {
  // Only clear caches after app is fully loaded
  setTimeout(() => {
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.includes('carbonify')) {
            caches.delete(name)
          }
        })
      })
    }
  }, 1000)

  // Version check without forced reload
  const currentVersion = '1.0.0'
  const storedVersion = localStorage.getItem('app-version')
  if (storedVersion !== currentVersion) {
    localStorage.setItem('app-version', currentVersion)
    console.log('App version updated to:', currentVersion)
  }
}

// Initialize analytics
analytics.initialize()

// Initialize mobile optimizations
initializeMobile()

// Initialize performance optimizations
optimizeImageLoading()

// Handle manifest.json fetch errors gracefully (suppress 401 errors from Vercel preview protection)
if (typeof window !== 'undefined') {
  // Intercept fetch requests to suppress manifest.json 401 errors
  const originalFetch = window.fetch
  window.fetch = function(...args) {
    const url = args[0]
    if (typeof url === 'string' && url.includes('manifest.json')) {
      return originalFetch.apply(this, args).catch((error) => {
        // Suppress 401 errors for manifest.json (expected on preview deployments)
        if (error.message?.includes('401') || error.status === 401) {
          console.debug('Manifest.json 401 (expected on preview deployments, harmless)')
          // Return a mock response to prevent error propagation
          return new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        throw error
      })
    }
    return originalFetch.apply(this, args)
  }

  // Suppress manifest.json 401 errors in console
  const originalError = console.error
  console.error = function(...args) {
    const message = args.join(' ')
    if ((message.includes('manifest.json') && message.includes('401')) ||
        (message.includes('Manifest fetch') && message.includes('401'))) {
      // Silently ignore - this is expected on Vercel preview deployments
      return
    }
    originalError.apply(console, args)
  }

  // Handle network errors for manifest.json
  window.addEventListener('error', (event) => {
    if (event.message?.includes('manifest.json') || 
        event.filename?.includes('manifest.json') ||
        (event.target?.href && event.target.href.includes('manifest.json'))) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }, true)
}
setupServiceWorkerCache()

// Handle browser extension context errors (harmless)
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Extension context invalidated')) {
    // This is a browser extension error, not our app - ignore it
    console.debug('Browser extension context invalidated (harmless)')
    event.preventDefault()
  }
})

// Handle unhandled promise rejections (like DOMException from service workers)
window.addEventListener('unhandledrejection', (event) => {
  // Silently ignore DOMException errors from service worker registration
  if (event.reason?.name === 'DOMException' && 
      (event.reason?.message?.includes('not, or is no longer, usable') ||
       event.reason?.message?.includes('Service Worker'))) {
    // Service worker errors are optional and not critical
    event.preventDefault()
    console.debug('Service Worker registration error (optional, safely ignored)')
    return
  }
  
  // Log other unhandled rejections for debugging
  console.warn('Unhandled promise rejection:', event.reason)
})
