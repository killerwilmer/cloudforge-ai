import { useAuth } from '@/contexts/AuthContext'
import { isValidEmail } from '@/utils/validation'
import { useState } from 'react'

interface SignUpFormProps {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export function SignUpForm({ onSuccess, onSwitchToLogin }: SignUpFormProps) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Verification state
  const [needsVerification, setNeedsVerification] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters'
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter'
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter'
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number'
    }
    if (!/[^A-Za-z0-9]/.test(pwd)) {
      return 'Password must contain at least one special character'
    }
    return null
  }

  // Countdown timer effect for resend button
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address')
      return
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      await signUp({ name: name.trim(), email, password })
      setNeedsVerification(true)
      setResendCountdown(60) // Start 60 second countdown
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate verification code
    if (!/^\d{6}$/.test(verificationCode)) {
      setError('Verification code must be 6 digits')
      return
    }

    setIsVerifying(true)

    try {
      await authService.verifyEmail(email, verificationCode)
      setSuccess(true)
      setTimeout(() => {
        onSwitchToLogin?.()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendCode = async () => {
    setError('')
    setIsLoading(true)

    try {
      await authService.resendVerificationCode(email)
      setResendCountdown(60) // Reset countdown
      setError('') // Clear any errors
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="signup-success">
        <h2>Email Verified!</h2>
        <p>Your account has been verified successfully. Redirecting to sign in...</p>
      </div>
    )
  }

  // Verification step
  if (needsVerification) {
    return (
      <div className="verification-form">
        <h2>Verify Your Email</h2>
        <p>We've sent a 6-digit verification code to <strong>{email}</strong></p>
        <p className="form-help">Please check your email and enter the code below.</p>

        <form onSubmit={handleVerify}>
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="verificationCode">Verification Code</label>
            <input
              id="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => {
                // Only allow digits and limit to 6 characters
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setVerificationCode(value)
              }}
              placeholder="Enter 6-digit code"
              disabled={isVerifying}
              required
              autoComplete="one-time-code"
              maxLength={6}
              pattern="\d{6}"
              autoFocus
              style={{ 
                fontSize: '1.5rem', 
                letterSpacing: '0.5rem', 
                textAlign: 'center' 
              }}
            />
          </div>

          <button type="submit" disabled={isVerifying || verificationCode.length !== 6} className="btn-primary">
            {isVerifying ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <div className="form-footer">
          <p>
            Didn't receive the code?{' '}
            {resendCountdown > 0 ? (
              <span className="text-muted">Resend in {resendCountdown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="btn-link"
              >
                Resend Code
              </button>
            )}
          </p>
          <p>
            <button type="button" onClick={onSwitchToLogin} className="btn-link">
              Back to Sign In
            </button>
          </p>
        </div>
      </div>
    )
  }

  // Sign up step
  return (
    <div className="signup-form">
      <h2>Create CloudForge AI Account</h2>
      <p>Start designing AWS infrastructure with AI</p>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            disabled={isLoading}
            required
            autoComplete="name"
          />
        </div>

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
            placeholder="Min 8 chars, uppercase, lowercase, number, special char"
            disabled={isLoading}
            required
            autoComplete="new-password"
          />
          <small className="form-help">
            Must include uppercase, lowercase, number, and special character
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            disabled={isLoading}
            required
            autoComplete="new-password"
          />
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary">
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      <div className="form-footer">
        <p>
          Already have an account?{' '}
          <button type="button" onClick={onSwitchToLogin} className="btn-link">
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
