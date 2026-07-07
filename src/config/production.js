/**
 * Production configuration settings
 */

export const PRODUCTION_CONFIG = {
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.carbonify.io',
  API_TIMEOUT: 30000, // 30 seconds

  // Feature Flags
  FEATURES: {
    ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    ERROR_REPORTING: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
    PERFORMANCE_MONITORING: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
    DEBUG_MODE: import.meta.env.DEV,
  },

  // Performance Settings
  PERFORMANCE: {
    LAZY_LOADING: true,
    IMAGE_OPTIMIZATION: true,
    CODE_SPLITTING: true,
    CACHING_ENABLED: true,
    CACHE_DURATION: 300000, // 5 minutes
  },

  // Security Settings
  SECURITY: {
    CSP_ENABLED: true,
    HTTPS_ONLY: true,
    SESSION_TIMEOUT: 3600000, // 1 hour
    MAX_LOGIN_ATTEMPTS: 5,
    RATE_LIMITING: true,
  },

  // Monitoring
  MONITORING: {
    ERROR_TRACKING: import.meta.env.VITE_SENTRY_DSN,
    ANALYTICS_ID: import.meta.env.VITE_GA_TRACKING_ID,
    PERFORMANCE_BUDGET: {
      FCP: 2000, // First Contentful Paint
      LCP: 4000, // Largest Contentful Paint
      FID: 100, // First Input Delay
      CLS: 0.1, // Cumulative Layout Shift
    },
  },

  // Database
  DATABASE: {
    CONNECTION_POOL_SIZE: 20,
    QUERY_TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
  },

  // Email
  EMAIL: {
    RATE_LIMIT: 100, // emails per hour
    TEMPLATE_CACHE: true,
    RETRY_ATTEMPTS: 3,
  },

  // Payment
  PAYMENT: {
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    WEBHOOK_TIMEOUT: 10000,
  },
}

export const getConfig = () => {
  const isProduction = import.meta.env.PROD
  const isDevelopment = import.meta.env.DEV

  return {
    ...PRODUCTION_CONFIG,
    ENV: {
      NODE_ENV: import.meta.env.MODE,
      IS_PRODUCTION: isProduction,
      IS_DEVELOPMENT: isDevelopment,
    },
  }
}
