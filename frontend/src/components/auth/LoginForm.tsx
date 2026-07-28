import { useAuth } from '@/contexts/AuthContext'
import { isValidEmail } from '@/utils/validation'
import { useState } from 'react'

interface LoginFormProps {
  onSuccess?: () => void
  onSwitchToSignUp?: () => void
}

export function LoginForm({ onSuccess, onSwitchToSignUp }: LoginFormProps) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    if (!password) {
      setError('Password is required')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setIsLoading(true)

    try {
      await signIn({ email, password })
      onSuccess?.()
    } catch (err) {
      // Provide user-friendly error messages
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed'
      
      if (errorMessage.includes('UserNotFoundException') || errorMessage.includes('NotAuthorizedException')) {
        setError('Invalid email or password. Please check your credentials and try again.')
      } else if (errorMessage.includes('UserNotConfirmedException')) {
        setError('Please verify your email address before signing in. Check your inbox for the verification code.')
      } else if (errorMessage.includes('TooManyRequestsException')) {
        setError('Too many login attempts. Please wait a few minutes and try again.')
      } else if (errorMessage.includes('Network')) {
        setError('Network error. Please check your internet connection and try again.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-form">
      <h2>Sign In to CloudForge AI</h2>
      <p>Design and deploy AWS infrastructure with AI assistance</p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={isLoading}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={isLoading}
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="form-footer">
        <p>
          Don't have an account?{' '}
          <button type="button" onClick={onSwitchToSignUp} className="btn-link">
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}
