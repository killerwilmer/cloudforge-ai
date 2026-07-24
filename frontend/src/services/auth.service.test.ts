import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from './auth.service'

// Mock fetch globally
global.fetch = vi.fn()

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
    vi.clearAllMocks()
  })

  describe('signUp', () => {
    it('should call signup endpoint with correct data', async () => {
      const mockResponse = {
        message: 'User registered successfully',
        userSub: 'test-user-sub',
      }

      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/signup'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'Password123!',
            name: 'Test User',
          }),
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('should throw error on failed signup', async () => {
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Email already exists' }),
      })

      await expect(
        authService.signUp({
          email: 'existing@example.com',
          password: 'Password123!',
          name: 'Test User',
        })
      ).rejects.toThrow('Email already exists')
    })
  })

  describe('signIn', () => {
    it('should call signin endpoint and return tokens', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      }

      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      })

      const result = await authService.signIn({
        email: 'test@example.com',
        password: 'Password123!',
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/signin'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'Password123!',
          }),
        })
      )

      expect(result).toEqual(mockTokens)
    })

    it('should throw error on invalid credentials', async () => {
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid email or password' }),
      })

      await expect(
        authService.signIn({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow('Invalid email or password')
    })
  })

  describe('signOut', () => {
    it('should call signout endpoint with access token', async () => {
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Signed out successfully' }),
      })

      await authService.signOut('test-access-token')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/signout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        })
      )
    })

    it('should throw error on signout failure', async () => {
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid token' }),
      })

      await expect(authService.signOut('invalid-token')).rejects.toThrow('Invalid token')
    })
  })

  describe('refreshToken', () => {
    it('should call refresh endpoint and return new tokens', async () => {
      const mockTokens = {
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        expiresIn: 3600,
      }

      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      })

      const result = await authService.refreshToken('test-refresh-token')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'test-refresh-token' }),
        })
      )

      expect(result).toEqual(mockTokens)
    })

    it('should throw error on expired refresh token', async () => {
      ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Refresh token expired' }),
      })

      await expect(authService.refreshToken('expired-token')).rejects.toThrow(
        'Refresh token expired'
      )
    })
  })

  describe('decodeToken', () => {
    it('should decode JWT token payload', () => {
      // Create a mock JWT token (header.payload.signature)
      const payload = {
        email: 'test@example.com',
        name: 'Test User',
        sub: 'user-sub-123',
      }

      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const result = authService.decodeToken(mockToken)

      expect(result).toEqual(payload)
    })
  })
})
