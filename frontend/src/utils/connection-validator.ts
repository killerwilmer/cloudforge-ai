/**
 * Connection validation rules for AWS services
 * Defines which services can connect to which other services
 */

export interface ConnectionRule {
  source: string
  target: string
  allowed: boolean
  reason?: string
}

// Define allowed connection patterns between AWS services
const CONNECTION_RULES: Record<string, string[]> = {
  'API Gateway': ['Lambda', 'DynamoDB', 'SQS', 'SNS', 'Step Functions', 'Cognito'],
  Lambda: ['DynamoDB', 'S3', 'SQS', 'SNS', 'RDS', 'API Gateway', 'EventBridge', 'Cognito'],
  DynamoDB: ['Lambda', 'EventBridge'],
  S3: ['Lambda', 'CloudFront', 'EventBridge'],
  Cognito: ['Lambda', 'API Gateway', 'SNS'],
  SQS: ['Lambda', 'SNS', 'EventBridge'],
  SNS: ['Lambda', 'SQS', 'EventBridge'],
  EventBridge: ['Lambda', 'SQS', 'SNS', 'Step Functions'],
  RDS: ['Lambda'],
  CloudFront: ['S3', 'API Gateway', 'Lambda'],
  'Step Functions': ['Lambda', 'DynamoDB', 'SQS', 'SNS'],
}

/**
 * Validates if a connection between two services is allowed
 */
export function validateConnection(sourceType: string, targetType: string): ConnectionRule {
  const allowedTargets = CONNECTION_RULES[sourceType] || []
  const allowed = allowedTargets.includes(targetType)

  let reason: string | undefined
  if (!allowed) {
    reason = `${sourceType} cannot directly connect to ${targetType}`
  }

  return {
    source: sourceType,
    target: targetType,
    allowed,
    reason,
  }
}

/**
 * Gets a user-friendly description of why a connection is valid
 */
export function getConnectionDescription(sourceType: string, targetType: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    'API Gateway': {
      Lambda: 'API Gateway invokes Lambda function',
      DynamoDB: 'API Gateway directly integrates with DynamoDB',
      SQS: 'API Gateway sends messages to SQS queue',
      SNS: 'API Gateway publishes to SNS topic',
      Cognito: 'API Gateway uses Cognito for authorization',
    },
    Lambda: {
      DynamoDB: 'Lambda reads/writes to DynamoDB table',
      S3: 'Lambda accesses S3 bucket',
      SQS: 'Lambda sends/receives SQS messages',
      SNS: 'Lambda publishes to SNS topic',
      RDS: 'Lambda queries RDS database',
      'API Gateway': 'Lambda invokes API Gateway endpoint',
      EventBridge: 'Lambda sends events to EventBridge',
      Cognito: 'Lambda interacts with Cognito user pool',
    },
    DynamoDB: {
      Lambda: 'DynamoDB triggers Lambda via streams',
      EventBridge: 'DynamoDB sends events to EventBridge',
    },
    S3: {
      Lambda: 'S3 triggers Lambda on events',
      CloudFront: 'S3 serves content through CloudFront',
      EventBridge: 'S3 sends events to EventBridge',
    },
    Cognito: {
      Lambda: 'Cognito triggers Lambda functions',
      'API Gateway': 'Cognito authorizes API Gateway requests',
      SNS: 'Cognito sends notifications via SNS',
    },
    SQS: {
      Lambda: 'SQS triggers Lambda function',
      SNS: 'SQS subscribes to SNS topic',
      EventBridge: 'SQS sends messages to EventBridge',
    },
    SNS: {
      Lambda: 'SNS triggers Lambda function',
      SQS: 'SNS sends messages to SQS queue',
      EventBridge: 'SNS sends events to EventBridge',
    },
    EventBridge: {
      Lambda: 'EventBridge triggers Lambda function',
      SQS: 'EventBridge sends events to SQS',
      SNS: 'EventBridge publishes to SNS topic',
    },
    RDS: {
      Lambda: 'RDS sends events to Lambda',
    },
    CloudFront: {
      S3: 'CloudFront serves content from S3',
      'API Gateway': 'CloudFront proxies to API Gateway',
      Lambda: 'CloudFront triggers Lambda@Edge',
    },
  }

  return descriptions[sourceType]?.[targetType] || `${sourceType} connects to ${targetType}`
}

/**
 * Determines the connection type based on source and target services
 */
export function getConnectionType(
  sourceType: string,
  targetType: string
): 'sync' | 'async' | 'data' {
  // Synchronous connections (request/response)
  const syncPatterns = [
    ['API Gateway', 'Lambda'],
    ['Lambda', 'DynamoDB'],
    ['Lambda', 'RDS'],
    ['Lambda', 'API Gateway'],
    ['CloudFront', 'S3'],
    ['CloudFront', 'API Gateway'],
  ]

  // Asynchronous connections (event-driven)
  const asyncPatterns = [
    ['Lambda', 'SNS'],
    ['Lambda', 'EventBridge'],
    ['SNS', 'Lambda'],
    ['SQS', 'Lambda'],
    ['EventBridge', 'Lambda'],
    ['S3', 'Lambda'],
    ['DynamoDB', 'Lambda'],
    ['Cognito', 'Lambda'],
  ]

  // Check if connection matches sync pattern
  for (const [source, target] of syncPatterns) {
    if (sourceType === source && targetType === target) {
      return 'sync'
    }
  }

  // Check if connection matches async pattern
  for (const [source, target] of asyncPatterns) {
    if (sourceType === source && targetType === target) {
      return 'async'
    }
  }

  // Default to data connection
  return 'data'
}

/**
 * Gets the protocol/method for a connection
 */
export function getConnectionProtocol(sourceType: string, targetType: string): string {
  const protocols: Record<string, Record<string, string>> = {
    'API Gateway': {
      Lambda: 'HTTPS/Invoke',
      DynamoDB: 'HTTPS/AWS Integration',
      SQS: 'HTTPS/SendMessage',
    },
    Lambda: {
      DynamoDB: 'AWS SDK',
      S3: 'AWS SDK',
      SQS: 'AWS SDK',
      SNS: 'AWS SDK',
      RDS: 'TCP/SQL',
      EventBridge: 'AWS SDK',
    },
    CloudFront: {
      S3: 'HTTPS',
      'API Gateway': 'HTTPS',
    },
  }

  return protocols[sourceType]?.[targetType] || 'AWS'
}
