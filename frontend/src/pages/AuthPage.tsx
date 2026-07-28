import { LoginForm } from '@/components/auth/LoginForm'
import { SignUpForm } from '@/components/auth/SignUpForm'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AuthPage.css'

export function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const handleLoginSuccess = () => {
    navigate('/')
  }

  const handleSignUpSuccess = () => {
    setMode('login')
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-logo">
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>☁️ CloudForge AI</h1>
        </div>

        {mode === 'login' ? (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onSwitchToSignUp={() => setMode('signup')}
          />
        ) : (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onSwitchToLogin={() => setMode('login')}
          />
        )}
      </div>
    </div>
  )
}
