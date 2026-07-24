import type {
    SignInRequest,
    SignUpRequest,
    User,
} from '@/services/auth.service'
import { authService } from '@/services/auth.service'
import { TokenStorage } from '@/utils/token-storage'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  signUp: (data: SignUpRequest) => Promise<void>
  signIn: (data: SignInRequest) => Promise<void>
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /**
   * Refresh authentication tokens
   */
  const refreshAuth = useCallback(async () => {
    try {
      const refreshToken = TokenStorage.getRefreshToken()

      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const tokens = await authService.refreshToken(refreshToken)
      TokenStorage.saveTokens(tokens)

      const userData = authService.decodeToken(tokens.idToken)
      setUser(userData)
    } catch (error) {
      console.error('Failed to refresh auth:', error)
      TokenStorage.clearTokens()
      setUser(null)
      throw error
    }
  }, [])

  /**
   * Initialize auth state from stored tokens
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        const idToken = TokenStorage.getIdToken()

        if (idToken && TokenStorage.hasValidTokens()) {
          const userData = authService.decodeToken(idToken)
          setUser(userData)
        } else if (TokenStorage.getRefreshToken()) {
          // Try to refresh if we have a refresh token
          await refreshAuth()
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
        TokenStorage.clearTokens()
      } finally {
        setIsLoading(false)
      }
    }

    void initialize()
  }, [refreshAuth])

  /**
   * Sign up a new user
   */
  const signUp = useCallback(async (data: SignUpRequest) => {
    try {
      await authService.signUp(data)
      // Note: User needs to verify email before signing in
    } catch (error) {
      console.error('Sign up failed:', error)
      throw error
    }
  }, [])

  /**
   * Sign in an existing user
   */
  const signIn = useCallback(async (data: SignInRequest) => {
    try {
      const tokens = await authService.signIn(data)
      TokenStorage.saveTokens(tokens)

      const userData = authService.decodeToken(tokens.idToken)
      setUser(userData)
    } catch (error) {
      console.error('Sign in failed:', error)
      throw error
    }
  }, [])

  /**
   * Sign out the current user
   */
  const signOut = useCallback(async () => {
    try {
      const accessToken = TokenStorage.getAccessToken()

      if (accessToken) {
        await authService.signOut(accessToken)
      }
    } catch (error) {
      console.error('Sign out failed:', error)
    } finally {
      TokenStorage.clearTokens()
      setUser(null)
    }
  }, [])

  // Set up automatic token refresh
  useEffect(() => {
    if (!user) return

    const checkTokenExpiration = async () => {
      if (TokenStorage.isExpired()) {
        try {
          await refreshAuth()
        } catch (error) {
          console.error('Auto refresh failed:', error)
          await signOut()
        }
      }
    }

    // Check every minute
    const intervalId = setInterval(checkTokenExpiration, 60 * 1000)

    return () => clearInterval(intervalId)
  }, [user, refreshAuth, signOut])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signUp,
    signIn,
    signOut,
    refreshAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
