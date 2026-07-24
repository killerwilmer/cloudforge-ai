/**
 * Core architecture types for CloudForge AI
 * These types represent AWS architectures, services, and connections
 */

export interface Architecture {
  services: AWSService[]
  connections: ServiceConnection[]
  metadata: ArchitectureMetadata
}

export interface AWSService {
  id: string
  type: string // e.g., "Lambda", "DynamoDB", "S3"
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

export interface ArchitectureContext {
  existingServices?: string[]
  constraints?: Constraint[]
  region?: string
}

export interface Constraint {
  type: string
  value: unknown
  description?: string
}

export type ServiceType =
  | 'Lambda'
  | 'API Gateway'
  | 'DynamoDB'
  | 'S3'
  | 'CloudFront'
  | 'Cognito'
  | 'SQS'
  | 'SNS'
  | 'EventBridge'
  | 'Step Functions'
  | 'ECS'
  | 'RDS'
  | 'ElastiCache'
  | 'VPC'
  | 'IAM'
