import type { AuthTokens } from '@/services/auth.service'

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'cloudforge_access_token',
  ID_TOKEN: 'cloudforge_id_token',
  REFRESH_TOKEN: 'cloudforge_refresh_token',
  EXPIRES_AT: 'cloudforge_expires_at',
} as const

/**
 * Token storage utility for managing authentication tokens in localStorage
 * All PII is stored securely in tokens, not logged
 */
export class TokenStorage {
  /**
   * Save authentication tokens to localStorage
   */
  static saveTokens(tokens: AuthTokens): void {
    const expiresAt = Date.now() + tokens.expiresIn * 1000

    localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, tokens.accessToken)
    localStorage.setItem(TOKEN_KEYS.ID_TOKEN, tokens.idToken)
    localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, tokens.refreshToken)
    localStorage.setItem(TOKEN_KEYS.EXPIRES_AT, expiresAt.toString())
  }

  /**
   * Get access token from localStorage
   */
  static getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)
  }

  /**
   * Get ID token from localStorage
   */
  static getIdToken(): string | null {
    return localStorage.getItem(TOKEN_KEYS.ID_TOKEN)
  }

  /**
   * Get refresh token from localStorage
   */
  static getRefreshToken(): string | null {
    return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN)
  }

  /**
   * Get token expiration timestamp
   */
  static getExpiresAt(): number | null {
    const expiresAt = localStorage.getItem(TOKEN_KEYS.EXPIRES_AT)
    return expiresAt ? parseInt(expiresAt, 10) : null
  }

  /**
   * Check if tokens are expired
   */
  static isExpired(): boolean {
    const expiresAt = this.getExpiresAt()
    if (!expiresAt) return true

    // Consider expired if less than 5 minutes remaining
    const bufferMs = 5 * 60 * 1000
    return Date.now() >= expiresAt - bufferMs
  }

  /**
   * Clear all tokens from localStorage
   */
  static clearTokens(): void {
    localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(TOKEN_KEYS.ID_TOKEN)
    localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN)
    localStorage.removeItem(TOKEN_KEYS.EXPIRES_AT)
  }

  /**
   * Check if user has valid tokens
   */
  static hasValidTokens(): boolean {
    return !!(
      this.getAccessToken() &&
      this.getIdToken() &&
      this.getRefreshToken() &&
      !this.isExpired()
    )
  }
}
