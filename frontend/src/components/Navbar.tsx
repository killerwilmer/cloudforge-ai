import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Navbar.css'

export function Navbar() {
  const { user, signOut, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Logout failed:', error)
      // Still redirect even if API call fails (tokens are cleared)
      navigate('/')
    } finally {
      setIsLoggingOut(false)
      setShowConfirm(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              CloudForge AI
            </h1>
          </div>

          <div className="navbar-menu">
            <div className="navbar-links">
              <button className="nav-link" onClick={() => navigate('/generate')}>
                Generate
              </button>
              <button className="nav-link" onClick={() => navigate('/editor')}>
                Visual Editor
              </button>
              <button className="nav-link" onClick={() => navigate('/aws-connection')}>
                AWS Connection
              </button>
              <button className="nav-link" onClick={() => navigate('/deployments')}>
                Deployment History
              </button>
            </div>
            <div className="navbar-user">
              <span className="user-email">{user?.email || 'User'}</span>
              <button
                className="btn-logout"
                onClick={() => setShowConfirm(true)}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {showConfirm && (
        <div className="logout-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Sign Out</h3>
            <p>Are you sure you want to sign out?</p>
            <div className="modal-actions">
              <button
                style={{
                  flex: '1',
                  height: '48px',
                  minHeight: '48px',
                  maxHeight: '48px',
                  padding: '0 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  borderRadius: '8px',
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  background: 'transparent',
                  opacity: isLoggingOut ? '0.5' : '1',
                }}
                onClick={() => setShowConfirm(false)}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: '1',
                  height: '48px',
                  minHeight: '48px',
                  maxHeight: '48px',
                  padding: '0 1.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  borderRadius: '8px',
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  border: '1px solid var(--destructive)',
                  color: 'white',
                  background: 'var(--destructive)',
                  opacity: isLoggingOut ? '0.5' : '1',
                }}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
