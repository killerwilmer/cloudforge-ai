import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuthPage } from '@/pages/AuthPage'
import { GenerateArchitecturePage } from '@/pages/GenerateArchitecturePage'
import { LandingPage } from '@/pages/LandingPage'
import { VisualEditorPage } from '@/pages/VisualEditorPage'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ReactFlowProvider } from 'reactflow'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/generate"
            element={
              <ProtectedRoute>
                <GenerateArchitecturePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/editor"
            element={
              <ProtectedRoute>
                <ReactFlowProvider>
                  <VisualEditorPage />
                </ReactFlowProvider>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
