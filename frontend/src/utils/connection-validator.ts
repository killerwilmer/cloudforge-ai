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

/**
 * Normalizes service type names to match validator rules
 * Handles cases where AI generates specific names like "Create Todo Handler" -> "Lambda"
 */
function normalizeServiceType(serviceType: string): string {
  const type = serviceType.toLowerCase()
  
  // IAM/Role patterns - check FIRST before Lambda (to handle "Lambda Execution Role")
  if (type.includes('role') || type.includes('iam') || type.includes('policy')) {
    // But if it's "Lambda" as part of "Lambda Execution Role", still treat as IAM
    return 'IAM'
  }
  
  // Monitoring patterns - check early
  if (type.includes('monitor') || type.includes('log') || type.includes('cloudwatch') || type.includes('xray')) {
    return 'Monitoring'
  }
  
  // Lambda patterns
  if (type.includes('handler') || type.includes('function') || type.includes('lambda')) {
    return 'Lambda'
  }
  
  // API Gateway patterns
  if (type.includes('api') || type.includes('rest') || type.includes('gateway')) {
    return 'API Gateway'
  }
  
  // DynamoDB patterns
  if (type.includes('table') || type.includes('dynamodb') || type.includes('database') || type.includes('db')) {
    return 'DynamoDB'
  }
  
  // Cognito patterns
  if (type.includes('auth') || type.includes('cognito') || type.includes('user pool')) {
    return 'Cognito'
  }
  
  // S3 patterns
  if (type.includes('bucket') || type.includes('s3') || type.includes('storage')) {
    return 'S3'
  }
  
  // SQS patterns
  if (type.includes('queue') || type.includes('sqs')) {
    return 'SQS'
  }
  
  // SNS patterns
  if (type.includes('topic') || type.includes('sns') || type.includes('notification')) {
    return 'SNS'
  }
  
  // EventBridge patterns
  if (type.includes('event') || type.includes('eventbridge')) {
    return 'EventBridge'
  }
  
  // RDS patterns
  if (type.includes('rds') || type.includes('sql') || type.includes('mysql') || type.includes('postgres')) {
    return 'RDS'
  }
  
  // CloudFront patterns
  if (type.includes('cdn') || type.includes('cloudfront') || type.includes('distribution')) {
    return 'CloudFront'
  }
  
  // Return original if no pattern matches
  return serviceType
}

// Define allowed connection patterns between AWS services
const CONNECTION_RULES: Record<string, string[]> = {
  'API Gateway': ['Lambda', 'DynamoDB', 'SQS', 'SNS', 'Step Functions', 'Cognito', 'IAM'],
  Lambda: ['DynamoDB', 'S3', 'SQS', 'SNS', 'RDS', 'API Gateway', 'EventBridge', 'Cognito', 'IAM', 'Monitoring'],
  DynamoDB: ['Lambda', 'EventBridge', 'Monitoring'],
  S3: ['Lambda', 'CloudFront', 'EventBridge', 'Monitoring'],
  Cognito: ['Lambda', 'API Gateway', 'SNS', 'IAM'],
  SQS: ['Lambda', 'SNS', 'EventBridge', 'IAM', 'Monitoring'],
  SNS: ['Lambda', 'SQS', 'EventBridge', 'Monitoring'],
  EventBridge: ['Lambda', 'SQS', 'SNS', 'Step Functions', 'Monitoring'],
  RDS: ['Lambda', 'Monitoring'],
  CloudFront: ['S3', 'API Gateway', 'Lambda', 'Monitoring'],
  'Step Functions': ['Lambda', 'DynamoDB', 'SQS', 'SNS', 'Monitoring'],
  IAM: [], // IAM roles can be attached to anything (special case)
  Monitoring: [], // Monitoring can monitor anything (special case)
}

/**
 * Validates if a connection between two services is allowed
 */
export function validateConnection(sourceType: string, targetType: string): ConnectionRule {
  // Normalize service types
  const normalizedSource = normalizeServiceType(sourceType)
  const normalizedTarget = normalizeServiceType(targetType)
  
  // Special case: IAM roles and Monitoring can connect from/to anything
  if (normalizedSource === 'IAM' || normalizedTarget === 'IAM') {
    return {
      source: sourceType,
      target: targetType,
      allowed: true,
    }
  }
  
  if (normalizedSource === 'Monitoring' || normalizedTarget === 'Monitoring') {
    return {
      source: sourceType,
      target: targetType,
      allowed: true,
    }
  }
  
  // Check if we have rules for the normalized source
  const allowedTargets = CONNECTION_RULES[normalizedSource]
  
  // If the source service type is completely unknown (no rules exist)
  if (!allowedTargets) {
    return {
      source: sourceType,
      target: targetType,
      allowed: true,
      reason: `Connection between custom services (validation skipped)`,
    }
  }
  
  // We have rules for this source - check if target is allowed
  const allowed = allowedTargets.includes(normalizedTarget)

  let reason: string | undefined
  if (!allowed) {
    reason = `${normalizedSource} cannot directly connect to ${normalizedTarget}`
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
  const normalizedSource = normalizeServiceType(sourceType)
  const normalizedTarget = normalizeServiceType(targetType)
  
  const descriptions: Record<string, Record<string, string>> = {
    'API Gateway': {
      Lambda: 'API Gateway invokes Lambda function',
      DynamoDB: 'API Gateway directly integrates with DynamoDB',
      SQS: 'API Gateway sends messages to SQS queue',
      SNS: 'API Gateway publishes to SNS topic',
      Cognito: 'API Gateway uses Cognito for authorization',
      IAM: 'API Gateway uses IAM role for permissions',
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
      IAM: 'Lambda uses IAM role for permissions',
      Monitoring: 'Lambda sends logs/metrics to monitoring',
    },
    DynamoDB: {
      Lambda: 'DynamoDB triggers Lambda via streams',
      EventBridge: 'DynamoDB sends events to EventBridge',
      Monitoring: 'DynamoDB sends metrics to monitoring',
    },
    S3: {
      Lambda: 'S3 triggers Lambda on events',
      CloudFront: 'S3 serves content through CloudFront',
      EventBridge: 'S3 sends events to EventBridge',
      Monitoring: 'S3 sends metrics to monitoring',
    },
    Cognito: {
      Lambda: 'Cognito triggers Lambda functions',
      'API Gateway': 'Cognito authorizes API Gateway requests',
      SNS: 'Cognito sends notifications via SNS',
      IAM: 'Cognito uses IAM role for permissions',
    },
    SQS: {
      Lambda: 'SQS triggers Lambda function',
      SNS: 'SQS subscribes to SNS topic',
      EventBridge: 'SQS sends messages to EventBridge',
      IAM: 'SQS uses IAM role for permissions',
      Monitoring: 'SQS sends metrics to monitoring',
    },
    SNS: {
      Lambda: 'SNS triggers Lambda function',
      SQS: 'SNS sends messages to SQS queue',
      EventBridge: 'SNS sends events to EventBridge',
      Monitoring: 'SNS sends metrics to monitoring',
    },
    EventBridge: {
      Lambda: 'EventBridge triggers Lambda function',
      SQS: 'EventBridge sends events to SQS',
      SNS: 'EventBridge publishes to SNS topic',
      Monitoring: 'EventBridge sends events to monitoring',
    },
    RDS: {
      Lambda: 'RDS sends events to Lambda',
      Monitoring: 'RDS sends metrics to monitoring',
    },
    CloudFront: {
      S3: 'CloudFront serves content from S3',
      'API Gateway': 'CloudFront proxies to API Gateway',
      Lambda: 'CloudFront triggers Lambda@Edge',
      Monitoring: 'CloudFront sends metrics to monitoring',
    },
    IAM: {
      Lambda: 'IAM role grants Lambda permissions',
      'API Gateway': 'IAM role grants API Gateway permissions',
      DynamoDB: 'IAM role grants DynamoDB permissions',
      S3: 'IAM role grants S3 permissions',
    },
    Monitoring: {
      Lambda: 'Monitors Lambda execution',
      'API Gateway': 'Monitors API Gateway requests',
      DynamoDB: 'Monitors DynamoDB operations',
    },
  }

  return descriptions[normalizedSource]?.[normalizedTarget] || `${sourceType} connects to ${targetType}`
}

/**
 * Determines the connection type based on source and target services
 */
export function getConnectionType(
  sourceType: string,
  targetType: string
): 'sync' | 'async' | 'data' {
  const normalizedSource = normalizeServiceType(sourceType)
  const normalizedTarget = normalizeServiceType(targetType)
  
  // Synchronous connections (request/response)
  const syncPatterns = [
    ['API Gateway', 'Lambda'],
    ['Lambda', 'DynamoDB'],
    ['Lambda', 'RDS'],
    ['Lambda', 'API Gateway'],
    ['CloudFront', 'S3'],
    ['CloudFront', 'API Gateway'],
    ['API Gateway', 'DynamoDB'],
    ['Cognito', 'API Gateway'],
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
    ['Lambda', 'SQS'],
  ]

  // Check if connection matches sync pattern
  for (const [source, target] of syncPatterns) {
    if (normalizedSource === source && normalizedTarget === target) {
      return 'sync'
    }
  }

  // Check if connection matches async pattern
  for (const [source, target] of asyncPatterns) {
    if (normalizedSource === source && normalizedTarget === target) {
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
  const normalizedSource = normalizeServiceType(sourceType)
  const normalizedTarget = normalizeServiceType(targetType)
  
  const protocols: Record<string, Record<string, string>> = {
    'API Gateway': {
      Lambda: 'HTTPS/Invoke',
      DynamoDB: 'HTTPS/AWS Integration',
      SQS: 'HTTPS/SendMessage',
      Cognito: 'Authorizer',
    },
    Lambda: {
      DynamoDB: 'AWS SDK',
      S3: 'AWS SDK',
      SQS: 'AWS SDK',
      SNS: 'AWS SDK',
      RDS: 'TCP/SQL',
      EventBridge: 'AWS SDK',
      Cognito: 'AWS SDK',
    },
    CloudFront: {
      S3: 'HTTPS',
      'API Gateway': 'HTTPS',
    },
    IAM: {
      Lambda: 'Assume Role',
      'API Gateway': 'Execution Role',
      DynamoDB: 'Service Role',
    },
    Cognito: {
      Lambda: 'Trigger',
      'API Gateway': 'Authorizer',
    },
    DynamoDB: {
      Lambda: 'Stream',
    },
  }

  return protocols[normalizedSource]?.[normalizedTarget] || 'AWS'
}
