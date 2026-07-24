import { API_CONFIG } from '@/config'

export interface SignUpRequest {
  email: string
  password: string
  name: string
}

export interface SignInRequest {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface User {
  email: string
  name: string
  sub: string
}

/**
 * Authentication service for communicating with backend auth API
 */
export class AuthService {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${API_CONFIG.baseUrl}/auth`
  }

  /**
   * Sign up a new user
   */
  async signUp(data: SignUpRequest): Promise<{ message: string; userSub: string }> {
    const response = await fetch(`${this.baseUrl}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Sign up failed')
    }

    return response.json()
  }

  /**
   * Sign in an existing user
   */
  async signIn(data: SignInRequest): Promise<AuthTokens> {
    const response = await fetch(`${this.baseUrl}/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Sign in failed')
    }

    return response.json()
  }

  /**
   * Sign out the current user
   */
  async signOut(accessToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/signout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Sign out failed')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await fetch(`${this.baseUrl}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Token refresh failed')
    }

    return response.json()
  }

  /**
   * Decode JWT token to get user info
   */
  decodeToken(idToken: string): User {
    const payload = JSON.parse(atob(idToken.split('.')[1]))
    return {
      email: payload.email,
      name: payload.name,
      sub: payload.sub,
    }
  }
}

export const authService = new AuthService()
