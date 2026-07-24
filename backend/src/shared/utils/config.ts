/**
 * Lambda environment configuration validator
 * Validates required environment variables at Lambda startup
 */

export interface LambdaConfig {
  awsRegion: string
  dynamodb: {
    usersTable: string
    diagramsTable: string
    deploymentsTable: string
  }
  s3: {
    diagramsBucket: string
    templatesBucket: string
  }
  bedrock: {
    modelId: string
    region: string
  }
  cognito: {
    userPoolId: string
    clientId: string
  }
  logLevel: string
}

// Required environment variables for all Lambda functions
const COMMON_ENV_VARS = [
  'AWS_REGION',
  'DYNAMODB_USERS_TABLE',
  'LOG_LEVEL',
] as const

// Additional required variables per Lambda type
const AUTH_ENV_VARS = ['COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID'] as const

const AI_ENGINE_ENV_VARS = ['BEDROCK_MODEL_ID', 'BEDROCK_REGION'] as const

const API_ENV_VARS = [
  'DYNAMODB_DIAGRAMS_TABLE',
  'S3_DIAGRAMS_BUCKET',
] as const

const DEPLOYMENT_ENV_VARS = [
  'DYNAMODB_DEPLOYMENTS_TABLE',
  'S3_TEMPLATES_BUCKET',
] as const

/**
 * Validate environment variables
 */
function validateEnv(requiredVars: readonly string[]): void {
  const missing: string[] = []

  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }
}

/**
 * Load common configuration
 */
export function loadCommonConfig(): LambdaConfig {
  validateEnv(COMMON_ENV_VARS)

  return {
    awsRegion: process.env.AWS_REGION!,
    dynamodb: {
      usersTable: process.env.DYNAMODB_USERS_TABLE!,
      diagramsTable: process.env.DYNAMODB_DIAGRAMS_TABLE || '',
      deploymentsTable: process.env.DYNAMODB_DEPLOYMENTS_TABLE || '',
    },
    s3: {
      diagramsBucket: process.env.S3_DIAGRAMS_BUCKET || '',
      templatesBucket: process.env.S3_TEMPLATES_BUCKET || '',
    },
    bedrock: {
      modelId: process.env.BEDROCK_MODEL_ID || '',
      region: process.env.BEDROCK_REGION || process.env.AWS_REGION!,
    },
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID || '',
      clientId: process.env.COGNITO_CLIENT_ID || '',
    },
    logLevel: process.env.LOG_LEVEL!,
  }
}

/**
 * Load auth Lambda configuration
 */
export function loadAuthConfig(): LambdaConfig {
  validateEnv([...COMMON_ENV_VARS, ...AUTH_ENV_VARS])
  return loadCommonConfig()
}

/**
 * Load AI engine Lambda configuration
 */
export function loadAIEngineConfig(): LambdaConfig {
  validateEnv([...COMMON_ENV_VARS, ...AI_ENGINE_ENV_VARS])
  return loadCommonConfig()
}

/**
 * Load API Lambda configuration
 */
export function loadAPIConfig(): LambdaConfig {
  validateEnv([...COMMON_ENV_VARS, ...API_ENV_VARS])
  return loadCommonConfig()
}

/**
 * Load deployment Lambda configuration
 */
export function loadDeploymentConfig(): LambdaConfig {
  validateEnv([...COMMON_ENV_VARS, ...DEPLOYMENT_ENV_VARS])
  return loadCommonConfig()
}
