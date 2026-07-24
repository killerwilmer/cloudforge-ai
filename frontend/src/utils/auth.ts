import { TokenStorage } from './token-storage'

/**
 * Get authentication token for API requests
 * Returns ID token for API Gateway Cognito authorization
 */
export function getAuthToken(): string | null {
  return TokenStorage.getIdToken()
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return TokenStorage.hasValidTokens()
}
