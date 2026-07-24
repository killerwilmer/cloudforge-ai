/**
 * Environment configuration loader
 * Validates required environment variables at startup
 */

interface EnvironmentConfig {
  apiBaseUrl: string
  awsRegion: string
  cognito: {
    userPoolId: string
    clientId: string
  }
  features: {
    githubImport: boolean
    costOptimization: boolean
    securityReview: boolean
  }
}

// Required environment variables
const REQUIRED_ENV_VARS = [
  'VITE_API_BASE_URL',
  'VITE_AWS_REGION',
] as const

// Validate environment variables
function validateEnv(): void {
  const missing: string[] = []

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!import.meta.env[envVar]) {
      missing.push(envVar)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please copy .env.example to .env.local and fill in the values.'
    )
  }
}

// Load and export configuration
function loadConfig(): EnvironmentConfig {
  validateEnv()

  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    awsRegion: import.meta.env.VITE_AWS_REGION,
    cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
    },
    features: {
      githubImport: import.meta.env.VITE_ENABLE_GITHUB_IMPORT === 'true',
      costOptimization: import.meta.env.VITE_ENABLE_COST_OPTIMIZATION !== 'false',
      securityReview: import.meta.env.VITE_ENABLE_SECURITY_REVIEW !== 'false',
    },
  }
}

export const env = loadConfig()
