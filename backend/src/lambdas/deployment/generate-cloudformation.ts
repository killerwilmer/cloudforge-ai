import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as yaml from 'yaml'
import type { Architecture, CloudFormationTemplate } from '../../shared/types'
import {
    errorResponse,
    logger,
    successResponse,
    validationErrorResponse,
} from '../../shared/utils'

interface GenerateCloudFormationRequest {
  architecture: Architecture
  format?: 'yaml' | 'json'
}

/**
 * Map AWS service types to CloudFormation resource types
 */
const SERVICE_TYPE_MAPPING: Record<string, string> = {
  Lambda: 'AWS::Lambda::Function',
  'API Gateway': 'AWS::ApiGatewayV2::Api',
  APIGateway: 'AWS::ApiGatewayV2::Api',
  DynamoDB: 'AWS::DynamoDB::Table',
  S3: 'AWS::S3::Bucket',
  SQS: 'AWS::SQS::Queue',
  SNS: 'AWS::SNS::Topic',
  CloudFront: 'AWS::CloudFront::Distribution',
  Cognito: 'AWS::Cognito::UserPool',
  EventBridge: 'AWS::Events::Rule',
  'Step Functions': 'AWS::StepFunctions::StateMachine',
  ECS: 'AWS::ECS::Service',
  RDS: 'AWS::RDS::DBInstance',
  ElastiCache: 'AWS::ElastiCache::CacheCluster',
  VPC: 'AWS::EC2::VPC',
  IAM: 'AWS::IAM::Role',
  CloudWatch: 'AWS::Logs::LogGroup',
  Monitoring: 'AWS::Logs::LogGroup',
}

/**
 * Generate CloudFormation handler
 * Converts Architecture object to CloudFormation template
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('CloudFormation generation request received')

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as GenerateCloudFormationRequest

    // Validation
    if (!body.architecture) {
      return validationErrorResponse([
        { field: 'architecture', message: 'Architecture is required' },
      ])
    }

    const { architecture, format = 'yaml' } = body

    // Validate architecture structure
    if (!architecture.services || !Array.isArray(architecture.services)) {
      return validationErrorResponse([
        { field: 'architecture.services', message: 'Services array is required' },
      ])
    }

    if (!architecture.connections || !Array.isArray(architecture.connections)) {
      return validationErrorResponse([
        {
          field: 'architecture.connections',
          message: 'Connections array is required',
        },
      ])
    }

    logger.info('Generating CloudFormation template', {
      serviceCount: architecture.services.length,
      connectionCount: architecture.connections.length,
    })

    // Generate CloudFormation template
    const template = generateTemplate(architecture)

    // Validate generated template
    const validationErrors = validateTemplate(template)
    if (validationErrors.length > 0) {
      logger.warn('Template validation warnings', { validationErrors })
    }

    // Format output
    const templateText =
      format === 'json'
        ? JSON.stringify(template, null, 2)
        : yaml.stringify(template, { indent: 2, lineWidth: 0 })

    logger.info('CloudFormation template generated successfully', {
      format,
      resourceCount: Object.keys(template.Resources).length,
      templateSize: templateText.length,
    })

    return successResponse({
      template: templateText,
      format,
      metadata: {
        resourceCount: Object.keys(template.Resources).length,
        parameterCount: template.Parameters
          ? Object.keys(template.Parameters).length
          : 0,
        outputCount: template.Outputs ? Object.keys(template.Outputs).length : 0,
      },
      validationWarnings: validationErrors,
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('CloudFormation generation failed', {
      error: err.message,
      errorName: err.name,
      stack: err.stack,
    })

    return errorResponse(500, 'Failed to generate CloudFormation template')
  }
}

/**
 * Generate CloudFormation template from Architecture
 */
function generateTemplate(architecture: Architecture): CloudFormationTemplate {
  // Generate a sanitized project name with timestamp for uniqueness
  const baseProjectName = architecture.metadata.name?.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase() || 'cloudforge-app';
  const uniqueProjectName = `${baseProjectName}-${Date.now()}`.substring(0, 50); // CloudFormation limit
  
  const template: CloudFormationTemplate = {
    AWSTemplateFormatVersion: '2010-09-09',
    Description:
      architecture.metadata.description ||
      `CloudForge AI Generated Architecture: ${architecture.metadata.name}`,
    Parameters: {
      ProjectName: {
        Type: 'String',
        Description: 'Name of the project (used for resource naming)',
        Default: uniqueProjectName,
        AllowedPattern: '^[a-z][a-z0-9-]*$',
        ConstraintDescription: 'Must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens',
      },
      Environment: {
        Type: 'String',
        Description: 'Environment name (dev, staging, prod)',
        Default: 'dev',
        AllowedValues: ['dev', 'staging', 'prod'],
      },
    },
    Resources: {},
    Outputs: {},
  }

  // Build service ID to logical ID mapping (CloudFormation requires alphanumeric)
  const serviceIdMap = new Map<string, string>()
  architecture.services.forEach((service) => {
    const logicalId = sanitizeLogicalId(service.id, service.name)
    serviceIdMap.set(service.id, logicalId)
  })

  // Generate resources for each service
  architecture.services.forEach((service) => {
    const logicalId = serviceIdMap.get(service.id)!
    const cfnType = SERVICE_TYPE_MAPPING[service.type]

    // Log service type and cfnType for debugging
    logger.info('Processing service', {
      serviceId: service.id,
      serviceName: service.name,
      serviceType: service.type,
      cfnType: cfnType,
    })

    if (!cfnType) {
      logger.warn('Unknown service type, skipping custom resource placeholder', {
        serviceType: service.type,
        serviceName: service.name,
      })
      // Skip placeholder custom resources that would fail deployment
      return
    }

    // Generate IAM role for Lambda functions first
    if (cfnType === 'AWS::Lambda::Function') {
      const roleLogicalId = `${logicalId}Role`
      logger.info('Creating IAM role for Lambda function', {
        logicalId,
        roleLogicalId,
      })
      template.Resources[roleLogicalId] = {
        Type: 'AWS::IAM::Role',
        Properties: {
          RoleName: {
            'Fn::Sub': `\${ProjectName}-\${Environment}-${sanitizeResourceName(service.name)}-role`,
          },
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: 'lambda.amazonaws.com' },
                Action: 'sts:AssumeRole',
              },
            ],
          },
          ManagedPolicyArns: [
            'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
          Tags: [
            { Key: 'ManagedBy', Value: 'CloudForgeAI' },
            { Key: 'ServiceName', Value: service.name },
          ],
        },
      }
    }

    const resource = generateResource(service, cfnType, architecture, serviceIdMap)
    
    // Skip if resource generation returned null (e.g., CloudWatch resources that are skipped)
    if (resource) {
      template.Resources[logicalId] = resource

      // Generate outputs for key services
      if (shouldGenerateOutput(service.type)) {
        template.Outputs![`${logicalId}Output`] = generateOutput(
          service,
          logicalId,
          cfnType
        )
      }
    }
  })

  // Add common parameters
  template.Parameters = {
    Environment: {
      Type: 'String',
      Description: 'Environment name (dev, staging, prod)',
      Default: 'dev',
    },
    ProjectName: {
      Type: 'String',
      Description: 'Project name for resource naming (defaults to stack name)',
      // No default - will be passed as parameter with stack name value
    },
  }

  return template
}

/**
 * Generate CloudFormation resource from service
 */
function generateResource(
  service: any,
  cfnType: string,
  architecture: Architecture,
  serviceIdMap: Map<string, string>
): any {
  const config = service.configuration || {}

  // Service-specific resource generation
  switch (service.type) {
    case 'Lambda':
      return generateLambdaResource(service, config, architecture, serviceIdMap)

    case 'API Gateway':
    case 'APIGateway':
      return generateAPIGatewayResource(service, config, architecture, serviceIdMap)

    case 'DynamoDB':
      return generateDynamoDBResource(service, config)

    case 'S3':
      return generateS3Resource(service, config)

    case 'SQS':
      return generateSQSResource(service, config)

    case 'SNS':
      return generateSNSResource(service, config)

    case 'Cognito':
      return generateCognitoResource(service, config)

    case 'IAM':
      return generateIAMResource(service, config)

    case 'CloudFront':
      return generateCloudFrontResource(service, config)

    case 'CloudWatch':
    case 'Monitoring':
      // Skip CloudWatch resources for now - CloudFormation auto-creates logs for Lambda
      logger.info('Skipping CloudWatch resource - logs auto-created by CloudFormation', {
        serviceName: service.name,
      })
      return null

    default:
      // Generic resource with basic properties
      return {
        Type: cfnType,
        Properties: {
          ...config,
          Tags: [
            { Key: 'ManagedBy', Value: 'CloudForgeAI' },
            { Key: 'ServiceName', Value: service.name },
          ],
        },
      }
  }
}

/**
 * Generate Lambda function resource
 */
function generateLambdaResource(
  service: any,
  config: any,
  architecture: Architecture,
  serviceIdMap: Map<string, string>
): any {
  const runtime = config.runtime || 'nodejs20.x'
  const memory = config.memory || 512
  const timeout = config.timeout || 30
  const logicalId = serviceIdMap.get(service.id)!

  return {
    Type: 'AWS::Lambda::Function',
    Properties: {
      FunctionName: {
        'Fn::Sub': `\${ProjectName}-\${Environment}-${sanitizeResourceName(service.name)}`,
      },
      Runtime: runtime,
      MemorySize: memory,
      Timeout: timeout,
      Handler: config.handler || 'index.handler',
      Role: { 'Fn::GetAtt': [`${logicalId}Role`, 'Arn'] },
      Code: {
        ZipFile: config.code || '// Replace with your Lambda code',
      },
      Environment: {
        Variables: {
          ENVIRONMENT: { Ref: 'Environment' },
          ...(config.environmentVariables || {}),
        },
      },
      Tags: [
        { Key: 'ManagedBy', Value: 'CloudForgeAI' },
        { Key: 'ServiceName', Value: service.name },
      ],
    },
  }
}

/**
 * Generate API Gateway resource
 */
function generateAPIGatewayResource(
  service: any,
  config: any,
  architecture: Architecture,
  serviceIdMap: Map<string, string>
): any {
  const corsEnabled = config.cors !== false

  return {
    Type: 'AWS::ApiGatewayV2::Api',
    Properties: {
      Name: { Ref: 'AWS::StackName' } + '-' + sanitizeResourceName(service.name),
      ProtocolType: config.protocol || 'HTTP',
      CorsConfiguration: corsEnabled
        ? {
            AllowOrigins: ['*'],
            AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            AllowHeaders: ['Content-Type', 'Authorization'],
          }
        : undefined,
      Tags: {
        ManagedBy: 'CloudForgeAI',
        ServiceName: service.name,
      },
    },
  }
}

/**
 * Generate DynamoDB table resource
 */
function generateDynamoDBResource(service: any, config: any): any {
  const billingMode = config.billingMode || 'PAY_PER_REQUEST'

  const properties: any = {
    TableName: { 'Fn::Sub': '${ProjectName}-${Environment}-' + sanitizeResourceName(service.name) },
    BillingMode: billingMode,
    AttributeDefinitions: config.attributeDefinitions || [
      { AttributeName: 'id', AttributeType: 'S' },
    ],
    KeySchema: config.keySchema || [{ AttributeName: 'id', KeyType: 'HASH' }],
    StreamSpecification:
      config.stream !== false
        ? {
            StreamViewType: 'NEW_AND_OLD_IMAGES',
          }
        : undefined,
    SSESpecification:
      config.encryption !== false
        ? {
            SSEEnabled: true,
          }
        : undefined,
    Tags: [
      { Key: 'ManagedBy', Value: 'CloudForgeAI' },
      { Key: 'ServiceName', Value: service.name },
    ],
  }

  // Add ProvisionedThroughput for PROVISIONED billing mode
  if (billingMode === 'PROVISIONED') {
    properties.ProvisionedThroughput = {
      ReadCapacityUnits: config.provisionedThroughput?.readCapacityUnits || 
                          config.readCapacityUnits || 5,
      WriteCapacityUnits: config.provisionedThroughput?.writeCapacityUnits || 
                           config.writeCapacityUnits || 5,
    }
  }

  return {
    Type: 'AWS::DynamoDB::Table',
    Properties: properties,
  }
}

/**
 * Generate S3 bucket resource
 */
function generateS3Resource(service: any, config: any): any {
  return {
    Type: 'AWS::S3::Bucket',
    Properties: {
      BucketName: { 'Fn::Sub': '${ProjectName}-${Environment}-' + sanitizeResourceName(service.name).toLowerCase() },
      PublicAccessBlockConfiguration:
        config.publicAccess !== true
          ? {
              BlockPublicAcls: true,
              BlockPublicPolicy: true,
              IgnorePublicAcls: true,
              RestrictPublicBuckets: true,
            }
          : undefined,
      BucketEncryption:
        config.encryption !== false
          ? {
              ServerSideEncryptionConfiguration: [
                {
                  ServerSideEncryptionByDefault: {
                    SSEAlgorithm: 'AES256',
                  },
                },
              ],
            }
          : undefined,
      VersioningConfiguration:
        config.versioning === true
          ? {
              Status: 'Enabled',
            }
          : undefined,
      Tags: [
        { Key: 'ManagedBy', Value: 'CloudForgeAI' },
        { Key: 'ServiceName', Value: service.name },
      ],
    },
  }
}

/**
 * Generate SQS queue resource
 */
function generateSQSResource(service: any, config: any): any {
  return {
    Type: 'AWS::SQS::Queue',
    Properties: {
      QueueName: { 'Fn::Sub': '${ProjectName}-${Environment}-' + sanitizeResourceName(service.name) },
      VisibilityTimeout: config.visibilityTimeout || 300,
      MessageRetentionPeriod: config.messageRetention || 345600, // 4 days
      ReceiveMessageWaitTimeSeconds: config.longPolling !== false ? 20 : 0,
      Tags: [
        { Key: 'ManagedBy', Value: 'CloudForgeAI' },
        { Key: 'ServiceName', Value: service.name },
      ],
    },
  }
}

/**
 * Generate SNS topic resource
 */
function generateSNSResource(service: any, config: any): any {
  return {
    Type: 'AWS::SNS::Topic',
    Properties: {
      TopicName: { 'Fn::Sub': '${ProjectName}-${Environment}-' + sanitizeResourceName(service.name) },
      DisplayName: service.name,
      Tags: [
        { Key: 'ManagedBy', Value: 'CloudForgeAI' },
        { Key: 'ServiceName', Value: service.name },
      ],
    },
  }
}

/**
 * Generate Cognito User Pool resource
 */
function generateCognitoResource(service: any, config: any): any {
  return {
    Type: 'AWS::Cognito::UserPool',
    Properties: {
      UserPoolName: { 'Fn::Sub': '${ProjectName}-${Environment}-' + sanitizeResourceName(service.name) },
      AutoVerifiedAttributes: config.autoVerify || ['email'],
      UsernameAttributes: ['email'],
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireUppercase: true,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: false,
        },
      },
      Schema: [
        {
          Name: 'email',
          AttributeDataType: 'String',
          Required: true,
          Mutable: false,
        },
      ],
      UserPoolTags: {
        ManagedBy: 'CloudForgeAI',
        ServiceName: service.name,
      },
    },
  }
}

/**
 * Generate IAM role resource
 */
function generateIAMResource(service: any, config: any): any {
  return {
    Type: 'AWS::IAM::Role',
    Properties: {
      RoleName: { 'Fn::Sub': '${ProjectName}-${Environment}-' + sanitizeResourceName(service.name) },
      AssumeRolePolicyDocument: config.assumeRolePolicy || {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      ManagedPolicyArns: config.managedPolicies || [
        'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
      ],
      Tags: [
        { Key: 'ManagedBy', Value: 'CloudForgeAI' },
        { Key: 'ServiceName', Value: service.name },
      ],
    },
  }
}

/**
 * Generate CloudFront distribution resource
 */
function generateCloudFrontResource(service: any, config: any): any {
  return {
    Type: 'AWS::CloudFront::Distribution',
    Properties: {
      DistributionConfig: {
        Enabled: config.enabled !== false,
        Comment: service.name || 'CloudForge AI Generated Distribution',
        DefaultCacheBehavior: {
          TargetOriginId: config.originId || 'default-origin',
          ViewerProtocolPolicy: config.viewerProtocolPolicy || 'redirect-to-https',
          AllowedMethods: config.allowedMethods || ['GET', 'HEAD', 'OPTIONS'],
          CachedMethods: ['GET', 'HEAD'],
          ForwardedValues: {
            QueryString: true,
            Cookies: { Forward: 'none' },
          },
          Compress: config.compress !== false,
          DefaultTTL: config.defaultTTL || 3600,
          MaxTTL: config.maxTTL || 86400,
          MinTTL: config.minTTL || 0,
        },
        Origins: config.origins || [
          {
            Id: 'default-origin',
            DomainName: '<<REPLACE_WITH_ORIGIN_DOMAIN>>',
            CustomOriginConfig: {
              HTTPPort: 80,
              HTTPSPort: 443,
              OriginProtocolPolicy: config.originProtocolPolicy || 'https-only',
            },
          },
        ],
        HttpVersion: config.httpVersion || 'http2',
        PriceClass: config.priceClass || 'PriceClass_100',
      },
      Tags: [
        { Key: 'ManagedBy', Value: 'CloudForgeAI' },
        { Key: 'ServiceName', Value: service.name },
      ],
    },
  }
}

/**
 * Generate CloudWatch log group resource
 */
function generateCloudWatchResource(service: any, config: any): any {
  return {
    Type: 'AWS::Logs::LogGroup',
    Properties: {
      LogGroupName: { 'Fn::Sub': '/aws/cloudforge/${ProjectName}-${Environment}-' + sanitizeResourceName(service.name) },
      RetentionInDays: config.retentionDays || 30,
      Tags: [
        { Key: 'ManagedBy', Value: 'CloudForge' },
        { Key: 'Service', Value: sanitizeResourceName(service.name) },
      ],
    },
  }
}

/**
 * Generate output for resource
 */
function generateOutput(service: any, logicalId: string, cfnType: string): any {
  const outputs: Record<string, any> = {
    'AWS::Lambda::Function': {
      Description: `${service.name} Function ARN`,
      Value: { 'Fn::GetAtt': [logicalId, 'Arn'] },
      Export: { Name: { 'Fn::Sub': '${AWS::StackName}-' + logicalId + '-Arn' } },
    },
    'AWS::ApiGatewayV2::Api': {
      Description: `${service.name} API Endpoint`,
      Value: {
        'Fn::Sub': 'https://${' + logicalId + '}.execute-api.${AWS::Region}.amazonaws.com',
      },
      Export: { Name: { 'Fn::Sub': '${AWS::StackName}-' + logicalId + '-Url' } },
    },
    'AWS::DynamoDB::Table': {
      Description: `${service.name} Table Name`,
      Value: { Ref: logicalId },
      Export: { Name: { 'Fn::Sub': '${AWS::StackName}-' + logicalId + '-Name' } },
    },
    'AWS::S3::Bucket': {
      Description: `${service.name} Bucket Name`,
      Value: { Ref: logicalId },
      Export: { Name: { 'Fn::Sub': '${AWS::StackName}-' + logicalId + '-Name' } },
    },
  }

  return (
    outputs[cfnType] || {
      Description: `${service.name} Resource`,
      Value: { Ref: logicalId },
    }
  )
}

/**
 * Validate CloudFormation template
 */
function validateTemplate(template: CloudFormationTemplate): string[] {
  const warnings: string[] = []

  // Check for empty resources
  if (Object.keys(template.Resources).length === 0) {
    warnings.push('Template has no resources')
  }

  // Check for Lambda functions without IAM roles
  Object.entries(template.Resources).forEach(([logicalId, resource]) => {
    if (resource.Type === 'AWS::Lambda::Function') {
      if (!resource.Properties.Role) {
        warnings.push(`Lambda function ${logicalId} missing IAM role`)
      }
    }
  })

  return warnings
}

/**
 * Check if service type should generate output
 */
function shouldGenerateOutput(serviceType: string): boolean {
  const outputTypes = [
    'Lambda',
    'API Gateway',
    'APIGateway',
    'DynamoDB',
    'S3',
    'SQS',
    'SNS',
  ]
  return outputTypes.includes(serviceType)
}

/**
 * Sanitize service ID/name for CloudFormation logical ID
 * CloudFormation requires alphanumeric characters only
 */
function sanitizeLogicalId(id: string, name: string): string {
  // Try to use name first, fall back to id
  const base = (name || id).replace(/[^a-zA-Z0-9]/g, '')
  
  // Ensure it starts with a letter
  if (!/^[a-zA-Z]/.test(base)) {
    return 'Resource' + base
  }
  
  return base
}

/**
 * Sanitize resource name for use in resource naming
 */
function sanitizeResourceName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
}

/**
 * Sanitize parameter value
 */
function sanitizeParameterValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
}
