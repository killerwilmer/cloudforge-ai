import { API_CONFIG } from '@/config'
import type {
    Deployment,
    DeploymentListItem,
    StartDeploymentRequest,
    StartDeploymentResponse,
} from '@/types'
import { getAuthToken } from '@/utils/auth'

/**
 * Deployment service for communicating with backend deployment API
 */
export class DeploymentService {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${API_CONFIG.baseUrl}/api/deployments`
  }

  /**
   * Start a new deployment
   */
  async startDeployment(
    data: StartDeploymentRequest
  ): Promise<StartDeploymentResponse> {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Authentication required')
    }

    const response = await fetch(`${this.baseUrl}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to start deployment')
    }

    return response.json()
  }

  /**
   * Get deployment details by ID
   */
  async getDeployment(deploymentId: string): Promise<Deployment> {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Authentication required')
    }

    const response = await fetch(`${this.baseUrl}/${deploymentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to get deployment')
    }

    const result = await response.json()
    return result.deployment
  }

  /**
   * List all deployments for the current user
   */
  async listDeployments(): Promise<DeploymentListItem[]> {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Authentication required')
    }

    const response = await fetch(this.baseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to list deployments')
    }

    const result = await response.json()
    return result.deployments || []
  }

  /**
   * Poll deployment status (helper for real-time updates)
   */
  async pollDeploymentStatus(
    deploymentId: string,
    onUpdate: (deployment: Deployment) => void,
    interval: number = 5000
  ): Promise<() => void> {
    let isPolling = true

    const poll = async () => {
      while (isPolling) {
        try {
          const deployment = await this.getDeployment(deploymentId)
          onUpdate(deployment)

          // Stop polling if deployment is complete or failed
          const terminalStatuses = ['COMPLETED', 'FAILED', 'POLL_STATUS_FAILED']
          if (terminalStatuses.includes(deployment.status)) {
            isPolling = false
            break
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, interval))
        } catch (error) {
          console.error('Error polling deployment status:', error)
          // Continue polling despite errors
          await new Promise((resolve) => setTimeout(resolve, interval))
        }
      }
    }

    // Start polling
    poll()

    // Return stop function
    return () => {
      isPolling = false
    }
  }
}

export const deploymentService = new DeploymentService()
