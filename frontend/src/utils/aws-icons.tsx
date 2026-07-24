/**
 * AWS Service Icons using react-icons
 * Maps AWS service types to appropriate icons
 */

import type { IconType } from 'react-icons'
import {
    FaCloud,
    FaDatabase,
    FaServer
} from 'react-icons/fa'
import { HiUserGroup } from 'react-icons/hi'
import {
    MdApi,
    MdCloudQueue,
    MdDashboard,
    MdNotifications,
    MdOutlineEventNote,
    MdSecurity,
    MdStorage,
} from 'react-icons/md'
import { RiCloudLine } from 'react-icons/ri'

export interface AWSServiceConfig {
  type: string
  color: string
  icon: IconType
  displayName?: string
}

/**
 * AWS Service configurations with proper icons from react-icons
 */
export const AWS_SERVICES: AWSServiceConfig[] = [
  {
    type: 'Lambda',
    color: '#FF9900',
    icon: FaServer, // Lambda functions
    displayName: 'Lambda',
  },
  {
    type: 'API Gateway',
    color: '#C925D1',
    icon: MdApi,
    displayName: 'API Gateway',
  },
  {
    type: 'DynamoDB',
    color: '#527FFF',
    icon: FaDatabase,
    displayName: 'DynamoDB',
  },
  {
    type: 'S3',
    color: '#569A31',
    icon: MdStorage,
    displayName: 'S3',
  },
  {
    type: 'Cognito',
    color: '#DD344C',
    icon: HiUserGroup,
    displayName: 'Cognito',
  },
  {
    type: 'SQS',
    color: '#FF4F8B',
    icon: MdCloudQueue,
    displayName: 'SQS',
  },
  {
    type: 'SNS',
    color: '#B7CA9D',
    icon: MdNotifications,
    displayName: 'SNS',
  },
  {
    type: 'EventBridge',
    color: '#FF4F8B',
    icon: MdOutlineEventNote,
    displayName: 'EventBridge',
  },
  {
    type: 'RDS',
    color: '#527FFF',
    icon: FaDatabase,
    displayName: 'RDS',
  },
  {
    type: 'CloudFront',
    color: '#8C4FFF',
    icon: FaCloud,
    displayName: 'CloudFront',
  },
]

/**
 * Get icon component for a service type (with normalization support)
 */
export function getServiceIcon(serviceType: string): IconType {
  const type = serviceType.toLowerCase()

  // Try exact match first
  const exactMatch = AWS_SERVICES.find((s) => s.type.toLowerCase() === type)
  if (exactMatch) return exactMatch.icon

  // Fallback to pattern matching for AI-generated names
  if (type.includes('lambda') || type.includes('function') || type.includes('handler')) {
    return FaServer
  }
  if (type.includes('api') || type.includes('gateway') || type.includes('rest')) {
    return MdApi
  }
  if (type.includes('dynamodb') || type.includes('table') || type.includes('database') || type.includes('db')) {
    return FaDatabase
  }
  if (type.includes('s3') || type.includes('bucket') || type.includes('storage')) {
    return MdStorage
  }
  if (type.includes('cognito') || type.includes('auth') || type.includes('user')) {
    return HiUserGroup
  }
  if (type.includes('sqs') || type.includes('queue')) {
    return MdCloudQueue
  }
  if (type.includes('sns') || type.includes('topic') || type.includes('notification')) {
    return MdNotifications
  }
  if (type.includes('event')) {
    return MdOutlineEventNote
  }
  if (type.includes('rds') || type.includes('sql') || type.includes('mysql') || type.includes('postgres')) {
    return FaDatabase
  }
  if (type.includes('cloudfront') || type.includes('cdn')) {
    return FaCloud
  }
  if (type.includes('role') || type.includes('iam') || type.includes('policy')) {
    return MdSecurity
  }
  if (type.includes('monitor') || type.includes('log') || type.includes('cloudwatch')) {
    return MdDashboard
  }

  // Default cloud icon
  return RiCloudLine
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
