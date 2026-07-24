/**
 * Common types used throughout the application
 */

// Result type for error handling
export type Result<TValue, TError> =
  | { success: true; value: TValue }
  | { success: false; error: TError }

// Validation result
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  severity: 'error' | 'warning'
  message: string
  field?: string
}

// API error response
export interface APIError {
  type: string
  message: string
  details?: Record<string, unknown>
}

// User authentication
export interface User {
  userId: string
  email: string
  awsAccountId?: string
  awsConnected: boolean
}

export interface AuthResult {
  userId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// AWS credentials
export interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiration: Date
}

export interface AWSConnectionResult {
  status: 'connected' | 'failed'
  accountId?: string
  error?: string
}
