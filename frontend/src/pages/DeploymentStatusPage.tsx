import { deploymentService } from '@/services/deployment.service'
import type { Deployment, StackResource } from '@/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import './DeploymentStatusPage.css'

/**
 * DeploymentStatusPage - Display real-time deployment progress
 * Requirements: 7.3, 7.4, 12.1, 12.2, 12.3, 12.4, 12.5
 */
export function DeploymentStatusPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>()
  const navigate = useNavigate()
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('DeploymentStatusPage: mounted', { deploymentId })
    
    if (!deploymentId) {
      console.error('DeploymentStatusPage: No deploymentId')
      setError('Deployment ID is required')
      setLoading(false)
      return
    }

    console.log('DeploymentStatusPage: Loading deployment...')
    // Initial load
    loadDeployment(deploymentId)

    let stopPolling: (() => void) | null = null

    // Start polling for updates
    deploymentService
      .pollDeploymentStatus(
        deploymentId,
        (updatedDeployment) => {
          console.log('DeploymentStatusPage: Poll update received', updatedDeployment)
          setDeployment(updatedDeployment)
          setLoading(false)
        },
        5000 // Poll every 5 seconds
      )
      .then((stop) => {
        console.log('DeploymentStatusPage: Polling started')
        stopPolling = stop
      })

    // Cleanup on unmount
    return () => {
      console.log('DeploymentStatusPage: Cleanup')
      if (stopPolling) {
        stopPolling()
      }
    }
  }, [deploymentId])

  const loadDeployment = async (id: string) => {
    try {
      const data = await deploymentService.getDeployment(id)
      setDeployment(data)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load deployment:', err)
      setError(err.message || 'Failed to load deployment')
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    if (status === 'COMPLETED') return '✓'
    if (status === 'FAILED' || status === 'POLL_STATUS_FAILED') return '✗'
    if (status === 'IN_PROGRESS' || status === 'VALIDATING') return '⟳'
    return '○'
  }

  const getStatusClass = (status: string) => {
    if (status === 'COMPLETED') return 'status-success'
    if (status === 'FAILED' || status === 'POLL_STATUS_FAILED') return 'status-error'
    if (status === 'IN_PROGRESS' || status === 'VALIDATING') return 'status-progress'
    return 'status-pending'
  }

  const getResourceStatusClass = (status: string) => {
    if (status.includes('COMPLETE') && !status.includes('ROLLBACK'))
      return 'resource-success'
    if (status.includes('FAILED')) return 'resource-error'
    if (status.includes('IN_PROGRESS')) return 'resource-progress'
    return 'resource-pending'
  }

  const groupResourcesByStatus = (resources: StackResource[] = []) => {
    const completed: StackResource[] = []
    const inProgress: StackResource[] = []
    const failed: StackResource[] = []
    const pending: StackResource[] = []

    // Create a map to track the latest status for each resource
    const latestResourceStatus = new Map<string, StackResource>()
    
    // CloudFormation returns events in reverse chronological order (newest first)
    // We want the most recent status for each resource
    resources.forEach((resource) => {
      const existingResource = latestResourceStatus.get(resource.logicalId)
      if (!existingResource) {
        latestResourceStatus.set(resource.logicalId, resource)
      }
    })

    // Now group the latest status for each resource
    latestResourceStatus.forEach((resource) => {
      if (resource.status.includes('COMPLETE') && !resource.status.includes('ROLLBACK')) {
        completed.push(resource)
      } else if (resource.status.includes('FAILED')) {
        failed.push(resource)
      } else if (resource.status.includes('IN_PROGRESS')) {
        inProgress.push(resource)
      } else {
        pending.push(resource)
      }
    })

    return { completed, inProgress, failed, pending }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  const getAWSConsoleUrl = (region: string, stackId?: string) => {
    if (!stackId) return null
    return `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/stackinfo?stackId=${encodeURIComponent(stackId)}`
  }

  if (loading && !deployment) {
    return (
      <div className="deployment-status-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading deployment status...</p>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '1rem' }}>
            Deployment ID: {deploymentId}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="deployment-status-page">
        <div className="error-container">
          <h2>Error Loading Deployment</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/deployments')}>
            Back to Deployments
          </button>
        </div>
      </div>
    )
  }

  if (!deployment) {
    return (
      <div className="deployment-status-page">
        <div className="error-container">
          <h2>Deployment Not Found</h2>
          <button onClick={() => navigate('/deployments')}>
            Back to Deployments
          </button>
        </div>
      </div>
    )
  }

  const resourceGroups = groupResourcesByStatus(deployment.resources)
  const isInProgress =
    deployment.status === 'IN_PROGRESS' || deployment.status === 'VALIDATING'
  const isComplete = deployment.status === 'COMPLETED'
  const isFailed =
    deployment.status === 'FAILED' || deployment.status === 'POLL_STATUS_FAILED'
  const consoleUrl = getAWSConsoleUrl(deployment.region, deployment.stackId)

  return (
    <div className="deployment-status-page">
      <div className="deployment-header">
        <div className="header-content">
          <Link to="/deployments" className="back-link">
            ← Back to Deployments
          </Link>
          <h1>{deployment.stackName}</h1>
          <div className="deployment-meta">
            <span className="meta-item">
              <strong>Region:</strong> {deployment.region}
            </span>
            <span className="meta-item">
              <strong>Started:</strong> {formatTimestamp(deployment.startedAt)}
            </span>
            {deployment.completedAt && (
              <span className="meta-item">
                <strong>Completed:</strong>{' '}
                {formatTimestamp(deployment.completedAt)}
              </span>
            )}
          </div>
        </div>
        {consoleUrl && (
          <a
            href={consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="console-link"
          >
            View in AWS Console →
          </a>
        )}
      </div>

      <div className="deployment-status-section">
        <h2>Deployment Status</h2>
        <div className={`status-card ${getStatusClass(deployment.status)}`}>
          <div className="status-icon">{getStatusIcon(deployment.status)}</div>
          <div className="status-details">
            <div className="status-label">{deployment.status}</div>
            {deployment.stackStatus && (
              <div className="stack-status">{deployment.stackStatus}</div>
            )}
            {deployment.errorMessage && (
              <div className="error-message">{deployment.errorMessage}</div>
            )}
          </div>
          {isInProgress && (
            <div className="progress-indicator">
              <div className="spinner-small"></div>
              <span>Deployment in progress...</span>
            </div>
          )}
        </div>
      </div>

      <div className="resources-section">
        <h2>Stack Resources</h2>

        {isFailed && resourceGroups.failed.length > 0 && (
          <div className="resource-group">
            <h3 className="group-title error">
              Failed Resources ({resourceGroups.failed.length})
            </h3>
            <div className="resource-list">
              {resourceGroups.failed.map((resource, index) => (
                <div key={index} className="resource-item resource-error">
                  <div className="resource-icon">✗</div>
                  <div className="resource-details">
                    <div className="resource-name">{resource.logicalId}</div>
                    <div className="resource-type">{resource.type}</div>
                    {resource.physicalId && (
                      <div className="resource-id">{resource.physicalId}</div>
                    )}
                  </div>
                  <div className="resource-status">{resource.status}</div>
                  <div className="resource-timestamp">
                    {formatTimestamp(resource.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {resourceGroups.inProgress.length > 0 && (
          <div className="resource-group">
            <h3 className="group-title progress">
              In Progress ({resourceGroups.inProgress.length})
            </h3>
            <div className="resource-list">
              {resourceGroups.inProgress.map((resource, index) => (
                <div key={index} className="resource-item resource-progress">
                  <div className="resource-icon spinner-small"></div>
                  <div className="resource-details">
                    <div className="resource-name">{resource.logicalId}</div>
                    <div className="resource-type">{resource.type}</div>
                  </div>
                  <div className="resource-status">{resource.status}</div>
                  <div className="resource-timestamp">
                    {formatTimestamp(resource.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {resourceGroups.completed.length > 0 && (
          <div className="resource-group">
            <h3 className="group-title success">
              Completed ({resourceGroups.completed.length})
            </h3>
            <div className="resource-list">
              {resourceGroups.completed.map((resource, index) => (
                <div key={index} className="resource-item resource-success">
                  <div className="resource-icon">✓</div>
                  <div className="resource-details">
                    <div className="resource-name">{resource.logicalId}</div>
                    <div className="resource-type">{resource.type}</div>
                    {resource.physicalId && (
                      <div className="resource-id">{resource.physicalId}</div>
                    )}
                  </div>
                  <div className="resource-status">{resource.status}</div>
                  <div className="resource-timestamp">
                    {formatTimestamp(resource.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!deployment.resources || deployment.resources.length === 0 ? (
          <div className="no-resources">
            <p>No resource information available yet.</p>
            {isInProgress && <p>Resources will appear as the deployment progresses.</p>}
          </div>
        ) : null}
      </div>

      {isComplete && deployment.stackOutputs && deployment.stackOutputs.length > 0 && (
        <div className="outputs-section">
          <h2>Stack Outputs</h2>
          <div className="outputs-list">
            {deployment.stackOutputs.map((output, index) => (
              <div key={index} className="output-item">
                <div className="output-key">{output.OutputKey}</div>
                <div className="output-value">{output.OutputValue}</div>
                {output.Description && (
                  <div className="output-description">{output.Description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
