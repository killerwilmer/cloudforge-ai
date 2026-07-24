/**
 * AWS Service Icons using official AWS Architecture Icons
 * From aws-react-icons package (based on official AWS icon set)
 */

import { ArchitectureServiceAmazonAPIGateway, ArchitectureServiceAmazonCloudFront, ArchitectureServiceAmazonCloudWatch, ArchitectureServiceAmazonCognito, ArchitectureServiceAmazonDynamoDB, ArchitectureServiceAmazonEventBridge, ArchitectureServiceAmazonRDS, ArchitectureServiceAmazonSimpleNotificationService, ArchitectureServiceAmazonSimpleQueueService, ArchitectureServiceAmazonSimpleStorageService, ArchitectureServiceAWSIAMIdentityCenter, ArchitectureServiceAWSLambda } from 'aws-react-icons'

// AWS React Icons return React components
type AWSIconComponent = React.ComponentType<{ size?: number | string }>

export interface AWSServiceConfig {
  type: string
  color: string
  icon: AWSIconComponent
  displayName?: string
}

/**
 * AWS Service configurations with official AWS Architecture Icons
 */
export const AWS_SERVICES: AWSServiceConfig[] = [
  {
    type: 'Lambda',
    color: '#FF9900',
    icon: ArchitectureServiceAWSLambda as AWSIconComponent,
    displayName: 'Lambda',
  },
  {
    type: 'API Gateway',
    color: '#C925D1',
    icon: ArchitectureServiceAmazonAPIGateway as AWSIconComponent,
    displayName: 'API Gateway',
  },
  {
    type: 'DynamoDB',
    color: '#527FFF',
    icon: ArchitectureServiceAmazonDynamoDB as AWSIconComponent,
    displayName: 'DynamoDB',
  },
  {
    type: 'S3',
    color: '#569A31',
    icon: ArchitectureServiceAmazonSimpleStorageService as AWSIconComponent,
    displayName: 'S3',
  },
  {
    type: 'Cognito',
    color: '#DD344C',
    icon: ArchitectureServiceAmazonCognito as AWSIconComponent,
    displayName: 'Cognito',
  },
  {
    type: 'SQS',
    color: '#FF4F8B',
    icon: ArchitectureServiceAmazonSimpleQueueService as AWSIconComponent,
    displayName: 'SQS',
  },
  {
    type: 'SNS',
    color: '#B7CA9D',
    icon: ArchitectureServiceAmazonSimpleNotificationService as AWSIconComponent,
    displayName: 'SNS',
  },
  {
    type: 'EventBridge',
    color: '#FF4F8B',
    icon: ArchitectureServiceAmazonEventBridge as AWSIconComponent,
    displayName: 'EventBridge',
  },
  {
    type: 'RDS',
    color: '#527FFF',
    icon: ArchitectureServiceAmazonRDS as AWSIconComponent,
    displayName: 'RDS',
  },
  {
    type: 'CloudFront',
    color: '#8C4FFF',
    icon: ArchitectureServiceAmazonCloudFront as AWSIconComponent,
    displayName: 'CloudFront',
  },
]

/**
 * Get icon component for a service type (with normalization support)
 */
export function getServiceIcon(serviceType: string): AWSIconComponent {
  const type = serviceType.toLowerCase()

  // Try exact match first
  const exactMatch = AWS_SERVICES.find((s) => s.type.toLowerCase() === type)
  if (exactMatch) return exactMatch.icon

  // Fallback to pattern matching for AI-generated names
  if (type.includes('lambda') || type.includes('function') || type.includes('handler')) {
    return ArchitectureServiceAWSLambda as AWSIconComponent
  }
  if (type.includes('api') || type.includes('gateway') || type.includes('rest')) {
    return ArchitectureServiceAmazonAPIGateway as AWSIconComponent
  }
  if (type.includes('dynamodb') || type.includes('table') || type.includes('database') || type.includes('db')) {
    return ArchitectureServiceAmazonDynamoDB as AWSIconComponent
  }
  if (type.includes('s3') || type.includes('bucket') || type.includes('storage')) {
    return ArchitectureServiceAmazonSimpleStorageService as AWSIconComponent
  }
  if (type.includes('cognito') || type.includes('auth') || type.includes('user')) {
    return ArchitectureServiceAmazonCognito as AWSIconComponent
  }
  if (type.includes('sqs') || type.includes('queue')) {
    return ArchitectureServiceAmazonSimpleQueueService as AWSIconComponent
  }
  if (type.includes('sns') || type.includes('topic') || type.includes('notification')) {
    return ArchitectureServiceAmazonSimpleNotificationService as AWSIconComponent
  }
  if (type.includes('event')) {
    return ArchitectureServiceAmazonEventBridge as AWSIconComponent
  }
  if (type.includes('rds') || type.includes('sql') || type.includes('mysql') || type.includes('postgres')) {
    return ArchitectureServiceAmazonRDS as AWSIconComponent
  }
  if (type.includes('cloudfront') || type.includes('cdn')) {
    return ArchitectureServiceAmazonCloudFront as AWSIconComponent
  }
  if (type.includes('role') || type.includes('iam') || type.includes('policy')) {
    return ArchitectureServiceAWSIAMIdentityCenter as AWSIconComponent
  }
  if (type.includes('monitor') || type.includes('log') || type.includes('cloudwatch')) {
    return ArchitectureServiceAmazonCloudWatch as AWSIconComponent
  }

  // Default to Lambda icon for unknown services
  return ArchitectureServiceAWSLambda as AWSIconComponent
}

/**
 * Get color for a service type (with normalization support)
 */
export function getServiceColor(serviceType: string): string {
  const type = serviceType.toLowerCase()

  // Try exact match first
  const exactMatch = AWS_SERVICES.find((s) => s.type.toLowerCase() === type)
  if (exactMatch) return exactMatch.color

  // Fallback to pattern matching for AI-generated names
  if (type.includes('lambda') || type.includes('function') || type.includes('handler')) {
    return '#FF9900'
  }
  if (type.includes('api') || type.includes('gateway') || type.includes('rest')) {
    return '#C925D1'
  }
  if (type.includes('dynamodb') || type.includes('table') || type.includes('database')) {
    return '#527FFF'
  }
  if (type.includes('s3') || type.includes('bucket') || type.includes('storage')) {
    return '#569A31'
  }
  if (type.includes('cognito') || type.includes('auth') || type.includes('user')) {
    return '#DD344C'
  }
  if (type.includes('sqs') || type.includes('queue')) {
    return '#FF4F8B'
  }
  if (type.includes('sns') || type.includes('topic') || type.includes('notification')) {
    return '#B7CA9D'
  }
  if (type.includes('event')) {
    return '#FF4F8B'
  }
  if (type.includes('rds') || type.includes('sql')) {
    return '#527FFF'
  }
  if (type.includes('cloudfront') || type.includes('cdn')) {
    return '#8C4FFF'
  }
  if (type.includes('role') || type.includes('iam') || type.includes('policy')) {
    return '#777777'
  }
  if (type.includes('monitor') || type.includes('log')) {
    return '#666666'
  }

  // Default gray for unknown services
  return '#888888'
}
