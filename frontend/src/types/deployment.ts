/**
 * Deployment types for frontend
 */

export type DeploymentStatus =
  | 'VALIDATING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'POLL_STATUS_FAILED'
  | 'ROLLBACK_IN_PROGRESS'
  | 'ROLLBACK_COMPLETE'

export type StackStatus =
  | 'CREATE_IN_PROGRESS'
  | 'CREATE_COMPLETE'
  | 'CREATE_FAILED'
  | 'ROLLBACK_IN_PROGRESS'
  | 'ROLLBACK_COMPLETE'
  | 'ROLLBACK_FAILED'
  | 'DELETE_IN_PROGRESS'
  | 'DELETE_COMPLETE'
  | 'DELETE_FAILED'
  | 'UPDATE_IN_PROGRESS'
  | 'UPDATE_COMPLETE'
  | 'UPDATE_FAILED'
  | 'UPDATE_ROLLBACK_IN_PROGRESS'
  | 'UPDATE_ROLLBACK_COMPLETE'
  | 'UPDATE_ROLLBACK_FAILED'

export interface StackResource {
  logicalId: string
  physicalId?: string
  type: string
  status: string
  timestamp: string
}

export interface StackOutput {
  OutputKey: string
  OutputValue: string
  Description?: string
  ExportName?: string
}

export interface Deployment {
  deploymentId: string
  userId: string
  diagramId?: string
  stackName: string
  region: string
  status: DeploymentStatus
  stackStatus?: StackStatus
  templateS3Key: string
  parameters?: Record<string, string>
  tags?: Record<string, string>
  createdResources?: string[]
  failedResources?: Array<{
    logicalId: string
    reason: string
  }>
  resources?: StackResource[]
  stackOutputs?: StackOutput[]
  startedAt: string
  completedAt?: string
  failedAt?: string
  lastPolledAt?: string
  errorMessage?: string
  stepFunctionArn?: string
  stackId?: string
}

export interface DeploymentListItem {
  deploymentId: string
  stackName: string
  region: string
  status: DeploymentStatus
  stackStatus?: StackStatus
  startedAt: string
  completedAt?: string
  failedAt?: string
}

export interface StartDeploymentRequest {
  stackName: string
  region: string
  template: string
  parameters?: Record<string, string>
  tags?: Record<string, string>
}

export interface StartDeploymentResponse {
  deploymentId: string
  stackName: string
  region: string
  executionArn: string
  message: string
}
