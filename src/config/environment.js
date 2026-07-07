/**
 * Environment configuration
 */

const ENVIRONMENT_CONFIG = {
  development: {
    API_BASE_URL: 'http://localhost:3000',
    DEBUG: true,
    LOG_LEVEL: 'debug',
    CACHE_DURATION: 0, // No caching in development
    ENABLE_ANALYTICS: false,
    ENABLE_ERROR_REPORTING: false,
  },

  production: {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://api.carbonify.io',
    DEBUG: false,
    LOG_LEVEL: 'error',
    CACHE_DURATION: 300000, // 5 minutes
    ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    ENABLE_ERROR_REPORTING: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
  },

  test: {
    API_BASE_URL: 'http://localhost:3000',
    DEBUG: true,
    LOG_LEVEL: 'error',
    CACHE_DURATION: 0,
    ENABLE_ANALYTICS: false,
    ENABLE_ERROR_REPORTING: false,
  },
}

export const getEnvironmentConfig = () => {
  const env = import.meta.env.MODE || 'development'
  return ENVIRONMENT_CONFIG[env] || ENVIRONMENT_CONFIG.development
}

export const isDevelopment = () => import.meta.env.DEV
export const isProduction = () => import.meta.env.PROD
export const isTest = () => import.meta.env.MODE === 'test'
