/**
 * Shared types for backend Lambda functions
 */

// Architecture types
export interface Architecture {
  services: AWSService[]
  connections: ServiceConnection[]
  metadata: ArchitectureMetadata
}

export interface AWSService {
  id: string
  type: string
  name: string
  configuration: Record<string, unknown>
  position: { x: number; y: number }
}

export interface ServiceConnection {
  id: string
  sourceId: string
  targetId: string
  type: 'sync' | 'async' | 'data'
  protocol?: string
}

export interface ArchitectureMetadata {
  name: string
  description?: string
  region?: string
  version: number
  createdAt: string
  updatedAt: string
  tags?: string[]
}

// CloudFormation types
export interface CloudFormationTemplate {
  AWSTemplateFormatVersion: string
  Description: string
  Parameters?: Record<string, Parameter>
  Resources: Record<string, Resource>
  Outputs?: Record<string, Output>
}

export interface Resource {
  Type: string
  Properties: Record<string, unknown>
  DependsOn?: string | string[]
}

export interface Parameter {
  Type: string
  Description?: string
  Default?: unknown
}

export interface Output {
  Description: string
  Value: unknown
  Export?: { Name: string }
}

// API types
export type Result<TValue, TError> =
  | { success: true; value: TValue }
  | { success: false; error: TError }

export interface APIError {
  type: string
  message: string
  details?: Record<string, unknown>
}

// Deployment types
export interface Deployment {
  id: string
  userId: string
  stackName: string
  status: DeploymentStatus
  startedAt: Date
  completedAt?: Date
  error?: string
}

export type DeploymentStatus =
  | 'VALIDATING'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'FAILED'
  | 'ROLLBACK_IN_PROGRESS'
  | 'ROLLBACK_COMPLETE'

// DynamoDB record types
export interface UserRecord {
  userId: string
  email: string
  createdAt: string
  lastLoginAt?: string
  awsAccountId?: string
  awsRoleArn?: string
  awsExternalId?: string
  credentialsSecretArn?: string
  githubConnected: boolean
  githubTokenSecretArn?: string
  preferences: {
    defaultRegion?: string
    theme?: 'light' | 'dark'
  }
}

export interface DiagramRecord {
  diagramId: string
  version: number
  userId: string
  name: string
  s3Key: string
  previewUrl?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
  updatedBy: string
  changeDescription?: string
}

export interface DeploymentRecord {
  deploymentId: string
  userId: string
  diagramId?: string
  stackName: string
  region: string
  status: DeploymentStatus
  templateS3Key: string
  parameters?: Record<string, string>
  tags?: Record<string, string>
  createdResources: string[]
  failedResources?: Array<{
    logicalId: string
    reason: string
  }>
  startedAt: string
  completedAt?: string
  error?: string
  stepFunctionArn?: string
  stackId?: string
  ttl?: number
}
