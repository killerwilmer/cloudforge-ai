import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ArchitectureProvider } from '@/contexts/ArchitectureContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuthPage } from '@/pages/AuthPage'
import { AWSConnectionPage } from '@/pages/AWSConnectionPage'
import { DeploymentHistoryPage } from '@/pages/DeploymentHistoryPage'
import { DeploymentStatusPage } from '@/pages/DeploymentStatusPage'
import { GenerateArchitecturePage } from '@/pages/GenerateArchitecturePage'
import { LandingPage } from '@/pages/LandingPage'
import { VisualEditorPage } from '@/pages/VisualEditorPage'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ReactFlowProvider } from 'reactflow'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <ArchitectureProvider>
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
            <Route
              path="/aws-connection"
              element={
                <ProtectedRoute>
                  <AWSConnectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deployments"
              element={
                <ProtectedRoute>
                  <DeploymentHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deployments/:deploymentId"
              element={
                <ProtectedRoute>
                  <DeploymentStatusPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ArchitectureProvider>
    </AuthProvider>
  )
}

export default App
