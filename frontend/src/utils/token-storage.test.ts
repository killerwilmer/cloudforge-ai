import { describe, it, expect, beforeEach } from 'vitest'
import { TokenStorage } from './token-storage'
import type { AuthTokens } from '@/services/auth.service'

describe('TokenStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('saveTokens and getTokens', () => {
    it('should save and retrieve tokens', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      }

      TokenStorage.saveTokens(tokens)

      expect(TokenStorage.getAccessToken()).toBe(tokens.accessToken)
      expect(TokenStorage.getIdToken()).toBe(tokens.idToken)
      expect(TokenStorage.getRefreshToken()).toBe(tokens.refreshToken)
    })

    it('should calculate expiration timestamp', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      }

      const beforeSave = Date.now()
      TokenStorage.saveTokens(tokens)
      const afterSave = Date.now()

      const expiresAt = TokenStorage.getExpiresAt()
      expect(expiresAt).toBeGreaterThanOrEqual(beforeSave + tokens.expiresIn * 1000)
      expect(expiresAt).toBeLessThanOrEqual(afterSave + tokens.expiresIn * 1000)
    })
  })

  describe('clearTokens', () => {
    it('should clear all tokens', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      }

      TokenStorage.saveTokens(tokens)
      TokenStorage.clearTokens()

      expect(TokenStorage.getAccessToken()).toBeNull()
      expect(TokenStorage.getIdToken()).toBeNull()
      expect(TokenStorage.getRefreshToken()).toBeNull()
      expect(TokenStorage.getExpiresAt()).toBeNull()
    })
  })

  describe('isExpired', () => {
    it('should return true when no expiration is set', () => {
      expect(TokenStorage.isExpired()).toBe(true)
    })

    it('should return false for valid tokens', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600, // 1 hour
      }

      TokenStorage.saveTokens(tokens)
      expect(TokenStorage.isExpired()).toBe(false)
    })

    it('should return true for expired tokens', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: -1, // Already expired
      }

      TokenStorage.saveTokens(tokens)
      expect(TokenStorage.isExpired()).toBe(true)
    })

    it('should consider tokens expired within 5 minute buffer', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 240, // 4 minutes (less than 5 minute buffer)
      }

      TokenStorage.saveTokens(tokens)
      expect(TokenStorage.isExpired()).toBe(true)
    })
  })

  describe('hasValidTokens', () => {
    it('should return false when no tokens exist', () => {
      expect(TokenStorage.hasValidTokens()).toBe(false)
    })

    it('should return false when tokens are expired', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: -1,
      }

      TokenStorage.saveTokens(tokens)
      expect(TokenStorage.hasValidTokens()).toBe(false)
    })

    it('should return true when valid tokens exist', () => {
      const tokens: AuthTokens = {
        accessToken: 'test-access-token',
        idToken: 'test-id-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
      }

      TokenStorage.saveTokens(tokens)
      expect(TokenStorage.hasValidTokens()).toBe(true)
    })

    it('should return false when tokens are incomplete', () => {
      // Save only access token
      localStorage.setItem('cloudforge_access_token', 'test-access-token')

      expect(TokenStorage.hasValidTokens()).toBe(false)
    })
  })
})
