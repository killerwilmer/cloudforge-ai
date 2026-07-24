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
            <h1>CloudForge AI</h1>
          </div>

          <div className="navbar-menu">
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
                className="btn-cancel"
                onClick={() => setShowConfirm(false)}
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button
                className="btn-confirm"
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
