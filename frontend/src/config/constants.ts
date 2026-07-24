/**
 * Application constants
 */

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
export const API_TIMEOUT = 30000 // 30 seconds

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: API_TIMEOUT,
} as const

// Retry Configuration
export const MAX_RETRY_ATTEMPTS = 3
export const RETRY_DELAY_MS = 1000

// CloudFormation
export const DEFAULT_CLOUDFORMATION_VERSION = '2010-09-09'
export const MAX_CLOUDFORMATION_RESOURCES = 500
export const MAX_TEMPLATE_SIZE_BYTES = 51200

// Architecture
export const DEFAULT_AWS_REGION = 'us-east-1'
export const AUTO_SAVE_INTERVAL_MS = 30000 // 30 seconds

// Validation
export const MAX_SERVICE_NAME_LENGTH = 64
export const MAX_ARCHITECTURE_DESCRIPTION_LENGTH = 1000

// Deployment
export const DEPLOYMENT_POLL_INTERVAL_MS = 5000 // 5 seconds
export const MAX_DEPLOYMENT_TIMEOUT_MS = 1800000 // 30 minutes

// Authentication
export const TOKEN_REFRESH_THRESHOLD_MS = 300000 // 5 minutes before expiry
export const SESSION_DURATION_MS = 86400000 // 24 hours
