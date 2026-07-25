import { Navbar } from '@/components/Navbar'
import { deploymentService } from '@/services/deployment.service'
import type { DeploymentListItem } from '@/types'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './DeploymentHistoryPage.css'

/**
 * DeploymentHistoryPage - List all deployments for current user
 * Requirements: 7.7, 12.6, 12.7
 */
export function DeploymentHistoryPage() {
  const navigate = useNavigate()
  const [deployments, setDeployments] = useState<DeploymentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadDeployments()
  }, [])

  const loadDeployments = async () => {
    try {
      setLoading(true)
      const data = await deploymentService.listDeployments()
      setDeployments(data)
      setError(null)
    } catch (err: any) {
      console.error('Failed to load deployments:', err)
      setError(err.message || 'Failed to load deployments')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    if (status === 'COMPLETED') return 'badge-success'
    if (status === 'FAILED' || status === 'POLL_STATUS_FAILED' || status === 'VALIDATION_FAILED' || status === 'ROLLBACK_COMPLETE') return 'badge-error'
    if (status === 'IN_PROGRESS' || status === 'VALIDATING' || status === 'ROLLBACK_IN_PROGRESS') return 'badge-progress'
    return 'badge-pending'
  }

  const getStatusIcon = (status: string) => {
    if (status === 'COMPLETED') return '✓'
    if (status === 'FAILED' || status === 'POLL_STATUS_FAILED' || status === 'VALIDATION_FAILED' || status === 'ROLLBACK_COMPLETE') return '✗'
    if (status === 'IN_PROGRESS' || status === 'VALIDATING' || status === 'ROLLBACK_IN_PROGRESS') return '⟳'
    return '○'
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const formatDuration = (startedAt: string, completedAt?: string, failedAt?: string) => {
    const start = new Date(startedAt).getTime()
    const end = completedAt
      ? new Date(completedAt).getTime()
      : failedAt
        ? new Date(failedAt).getTime()
        : Date.now()

    const durationMs = end - start
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const getAWSConsoleUrl = (region: string, stackName: string) => {
    return `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks?filteringText=${encodeURIComponent(stackName)}`
  }

  const handleDeleteDeployment = async (deploymentId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this deployment? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingId(deploymentId)
      await deploymentService.deleteDeployment(deploymentId)
      
      // Remove from local state
      setDeployments((prev) => prev.filter((d) => d.deploymentId !== deploymentId))
      
      // Show success message (optional)
      console.log('Deployment deleted successfully')
    } catch (err: any) {
      console.error('Failed to delete deployment:', err)
      alert(err.message || 'Failed to delete deployment')
    } finally {
      setDeletingId(null)
    }
  }

  const canDelete = (status: string) => {
    // Allow deletion for failed or incomplete deployments
    return ['FAILED', 'POLL_STATUS_FAILED', 'VALIDATION_FAILED', 'ROLLBACK_COMPLETE'].includes(status)
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="deployment-history-page">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading deployments...</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Navbar />
        <div className="deployment-history-page">
          <div className="error-container">
            <h2>Error Loading Deployments</h2>
            <p>{error}</p>
            <button onClick={loadDeployments}>Retry</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="deployment-history-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Deployment History</h1>
          <p className="subtitle">
            View all your CloudFormation stack deployments
          </p>
        </div>
        <button className="refresh-button" onClick={loadDeployments}>
          ↻ Refresh
        </button>
      </div>

      {deployments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2>No Deployments Yet</h2>
          <p>You haven't deployed any CloudFormation stacks yet.</p>
          <button onClick={() => navigate('/generate')} className="cta-button">
            Create Your First Architecture
          </button>
        </div>
      ) : (
        <div className="deployments-container">
          <div className="deployments-stats">
            <div className="stat-card">
              <div className="stat-value">{deployments.length}</div>
              <div className="stat-label">Total Deployments</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {deployments.filter((d) => d.status === 'COMPLETED').length}
              </div>
              <div className="stat-label">Successful</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {
                  deployments.filter(
                    (d) => d.status === 'IN_PROGRESS' || d.status === 'VALIDATING' || d.status === 'ROLLBACK_IN_PROGRESS'
                  ).length
                }
              </div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {
                  deployments.filter(
                    (d) => d.status === 'FAILED' || d.status === 'POLL_STATUS_FAILED' || d.status === 'VALIDATION_FAILED' || d.status === 'ROLLBACK_COMPLETE'
                  ).length
                }
              </div>
              <div className="stat-label">Failed</div>
            </div>
          </div>

          <div className="deployments-list">
            {deployments.map((deployment) => (
              <div
                key={deployment.deploymentId}
                className="deployment-card"
                onClick={() => navigate(`/deployments/${deployment.deploymentId}`)}
              >
                <div className="card-header">
                  <div className="card-title-section">
                    <h3>{deployment.stackName}</h3>
                    <span className="region-badge">{deployment.region}</span>
                  </div>
                  <div
                    className={`status-badge ${getStatusBadgeClass(deployment.status)}`}
                  >
                    <span className="badge-icon">
                      {getStatusIcon(deployment.status)}
                    </span>
                    <span className="badge-text">{deployment.status}</span>
                  </div>
                </div>

                {deployment.stackStatus && (
                  <div className="stack-status-text">{deployment.stackStatus}</div>
                )}

                <div className="card-details">
                  <div className="detail-row">
                    <span className="detail-label">Started:</span>
                    <span className="detail-value">
                      {formatTimestamp(deployment.startedAt)}
                    </span>
                  </div>

                  {deployment.completedAt && (
                    <div className="detail-row">
                      <span className="detail-label">Completed:</span>
                      <span className="detail-value">
                        {formatTimestamp(deployment.completedAt)}
                      </span>
                    </div>
                  )}

                  {deployment.failedAt && (
                    <div className="detail-row">
                      <span className="detail-label">Failed:</span>
                      <span className="detail-value">
                        {formatTimestamp(deployment.failedAt)}
                      </span>
                    </div>
                  )}

                  <div className="detail-row">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">
                      {formatDuration(
                        deployment.startedAt,
                        deployment.completedAt,
                        deployment.failedAt
                      )}
                    </span>
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    className="action-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/deployments/${deployment.deploymentId}`)
                    }}
                  >
                    View Details →
                  </button>
                  <a
                    href={getAWSConsoleUrl(deployment.region, deployment.stackName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-link console-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    AWS Console ↗
                  </a>
                  {canDelete(deployment.status) && (
                    <button
                      className="action-link delete-link"
                      onClick={(e) => handleDeleteDeployment(deployment.deploymentId, e)}
                      disabled={deletingId === deployment.deploymentId}
                    >
                      {deletingId === deployment.deploymentId ? 'Deleting...' : '🗑️ Delete'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  )
}
