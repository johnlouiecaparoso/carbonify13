/**
 * Mobile utilities for touch interactions and responsive behavior
 */

/**
 * Touch gesture utilities
 */
export const touchGestures = {
  /**
   * Detect swipe direction
   */
  detectSwipe(element, options = {}) {
    const { threshold = 50, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown } = options

    let startX = 0
    let startY = 0
    let endX = 0
    let endY = 0

    element.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    })

    element.addEventListener('touchend', (e) => {
      endX = e.changedTouches[0].clientX
      endY = e.changedTouches[0].clientY

      const deltaX = endX - startX
      const deltaY = endY - startY

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > threshold) {
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight()
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft()
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > threshold) {
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown()
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp()
          }
        }
      }
    })
  },

  /**
   * Detect pinch gesture
   */
  detectPinch(element, options = {}) {
    const { onPinchStart, onPinchMove, onPinchEnd } = options

    let initialDistance = 0
    let currentDistance = 0

    element.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2),
        )
        if (onPinchStart) onPinchStart(initialDistance)
      }
    })

    element.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2),
        )
        if (onPinchMove) onPinchMove(currentDistance, initialDistance)
      }
    })

    element.addEventListener('touchend', (e) => {
      if (e.touches.length < 2 && onPinchEnd) {
        onPinchEnd(currentDistance, initialDistance)
      }
    })
  },

  /**
   * Detect double tap
   */
  detectDoubleTap(element, callback) {
    let lastTap = 0
    const doubleTapDelay = 300

    element.addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime()
      const tapLength = currentTime - lastTap

      if (tapLength < doubleTapDelay && tapLength > 0) {
        callback(e)
      }
      lastTap = currentTime
    })
  },
}

/**
 * Mobile viewport utilities
 */
export const viewport = {
  /**
   * Get viewport dimensions
   */
  getDimensions() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    }
  },

  /**
   * Check if device is mobile
   */
  isMobile() {
    return window.innerWidth <= 768
  },

  /**
   * Check if device is tablet
   */
  isTablet() {
    return window.innerWidth > 768 && window.innerWidth <= 1024
  },

  /**
   * Check if device is desktop
   */
  isDesktop() {
    return window.innerWidth > 1024
  },

  /**
   * Check if device supports touch
   */
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  },

  /**
   * Get device orientation
   */
  getOrientation() {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  },

  /**
   * Listen for orientation changes
   */
  onOrientationChange(callback) {
    window.addEventListener('orientationchange', () => {
      setTimeout(callback, 100) // Small delay to ensure dimensions are updated
    })
  },
}

/**
 * Mobile-specific CSS utilities
 */
export const mobileCSS = {
  /**
   * Add mobile-specific styles
   */
  addMobileStyles() {
    const style = document.createElement('style')
    style.textContent = `
      /* Mobile-specific styles */
      @media (max-width: 768px) {
        /* Prevent zoom on input focus */
        input, select, textarea {
          font-size: 16px !important;
        }

        /* Improve touch targets */
        button, a, input, select, textarea {
          min-height: 44px;
          min-width: 44px;
        }

        /* Better scrolling */
        body {
          -webkit-overflow-scrolling: touch;
        }

        /* Prevent horizontal scroll */
        body {
          overflow-x: hidden;
        }

        /* Improve text selection */
        ::selection {
          background: rgba(59, 130, 246, 0.3);
        }
      }

      /* Touch device styles */
      @media (hover: none) and (pointer: coarse) {
        /* Remove hover effects on touch devices */
        button:hover, a:hover {
          transform: none !important;
        }

        /* Add touch feedback */
        button:active, a:active {
          transform: scale(0.95);
          transition: transform 0.1s;
        }
      }

      /* High DPI displays */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        /* Optimize for retina displays */
        img {
          image-rendering: -webkit-optimize-contrast;
        }
      }
    `
    document.head.appendChild(style)
  },

  /**
   * Add safe area support for notched devices
   */
  addSafeAreaSupport() {
    const style = document.createElement('style')
    style.textContent = `
      /* Safe area support for notched devices */
      .safe-area-top {
        padding-top: env(safe-area-inset-top);
      }

      .safe-area-bottom {
        padding-bottom: env(safe-area-inset-bottom);
      }

      .safe-area-left {
        padding-left: env(safe-area-inset-left);
      }

      .safe-area-right {
        padding-right: env(safe-area-inset-right);
      }

      .safe-area-all {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
    `
    document.head.appendChild(style)
  },
}

/**
 * Mobile performance utilities
 */
export const mobilePerformance = {
  /**
   * Optimize images for mobile
   */
  optimizeImages() {
    const images = document.querySelectorAll('img')
    images.forEach((img) => {
      // Add loading="lazy" for better performance
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy')
      }

      // Add sizes attribute for responsive images
      if (!img.hasAttribute('sizes')) {
        img.setAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw')
      }
    })
  },

  /**
   * Preload critical resources
   */
  preloadCriticalResources() {
    // Only preload resources that actually exist
    const criticalResources = [
      // Add only existing resources here
      // '/fonts/main.woff2', // Remove if doesn't exist
      // '/css/critical.css', // Remove if doesn't exist
    ]

    criticalResources.forEach((resource) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = resource
      link.as = resource.endsWith('.woff2') ? 'font' : 'style'
      if (resource.endsWith('.woff2')) {
        link.crossOrigin = 'anonymous'
      }
      document.head.appendChild(link)
    })
  },

  /**
   * Enable service worker for offline support
   */
  enableServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return
    }

    const { protocol, hostname } = window.location
    const isSecureContext =
      window.isSecureContext || protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1'

    if (!isSecureContext) {
      console.debug('Skipping service worker registration: insecure context detected')
      return
    }

    // Use setTimeout to avoid DOMException from using objects after page navigation
    setTimeout(() => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          if (registration && registration.active) {
            console.log('✅ Service Worker registered successfully')
          }
        })
        .catch(() => { /* optional: SW not available */ })
    }, 100)
  },
}

/**
 * Mobile navigation utilities
 */
export const mobileNavigation = {
  /**
   * Create mobile-friendly navigation
   */
  createMobileNav() {
    const nav = document.createElement('nav')
    nav.className = 'mobile-nav'
    nav.innerHTML = `
      <div class="mobile-nav-header">
        <button class="mobile-nav-toggle" aria-label="Toggle navigation">
          <span class="hamburger"></span>
        </button>
        <div class="mobile-nav-logo">Carbonify</div>
      </div>
      <div class="mobile-nav-content">
        <ul class="mobile-nav-links">
          <li><a href="/">Home</a></li>
          <li><a href="/marketplace">Marketplace</a></li>
          <li><a href="/wallet">Wallet</a></li>
          <li><a href="/certificates">Certificates</a></li>
          <li><a href="/carbon-calculator">Carbon Calculator</a></li>
          <li><a href="/profile">Profile</a></li>
        </ul>
      </div>
    `

    // Add mobile nav styles
    const style = document.createElement('style')
    style.textContent = `
      .mobile-nav {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
      }

      .mobile-nav.open {
        transform: translateY(0);
      }

      .mobile-nav-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border-bottom: 1px solid #e5e7eb;
      }

      .mobile-nav-toggle {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.5rem;
      }

      .hamburger {
        display: block;
        width: 24px;
        height: 2px;
        background: #374151;
        position: relative;
        transition: all 0.3s ease;
      }

      .hamburger::before,
      .hamburger::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 2px;
        background: #374151;
        transition: all 0.3s ease;
      }

      .hamburger::before {
        top: -8px;
      }

      .hamburger::after {
        top: 8px;
      }

      .mobile-nav-content {
        padding: 1rem;
      }

      .mobile-nav-links {
        list-style: none;
        margin: 0;
        padding: 0;
      }

      .mobile-nav-links li {
        margin-bottom: 0.5rem;
      }

      .mobile-nav-links a {
        display: block;
        padding: 0.75rem;
        color: #374151;
        text-decoration: none;
        border-radius: 6px;
        transition: background-color 0.2s;
      }

      .mobile-nav-links a:hover {
        background: #f3f4f6;
      }

      @media (min-width: 769px) {
        .mobile-nav {
          display: none;
        }
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(nav)

    // Add toggle functionality
    const toggle = nav.querySelector('.mobile-nav-toggle')
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open')
    })
  },
}

/**
 * Initialize mobile enhancements
 */
export function initializeMobile() {
  // Add mobile-specific styles
  mobileCSS.addMobileStyles()
  mobileCSS.addSafeAreaSupport()

  // Optimize performance
  mobilePerformance.optimizeImages()
  mobilePerformance.preloadCriticalResources()
  mobilePerformance.enableServiceWorker()

  // Create mobile navigation if on mobile
  if (viewport.isMobile()) {
    mobileNavigation.createMobileNav()
  }

  // Listen for orientation changes
  viewport.onOrientationChange(() => {
    // Re-initialize mobile navigation if needed
    if (viewport.isMobile()) {
      const existingNav = document.querySelector('.mobile-nav')
      if (!existingNav) {
        mobileNavigation.createMobileNav()
      }
    }
  })
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initializeMobile)
}
