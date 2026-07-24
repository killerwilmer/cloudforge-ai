import { TokenStorage } from './token-storage'

/**
 * Get authentication token for API requests
 * Returns access token if available, null otherwise
 */
export function getAuthToken(): string | null {
  return TokenStorage.getAccessToken()
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return TokenStorage.hasValidTokens()
}
