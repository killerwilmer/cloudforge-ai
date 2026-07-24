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

    setIsLoading(true)

    try {
      await signIn({ email, password })
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
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
