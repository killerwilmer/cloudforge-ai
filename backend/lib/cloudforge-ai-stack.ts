import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as sfn from 'aws-cdk-lib/aws-stepfunctions'
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { Construct } from 'constructs'

/**
 * Main CloudForge AI Infrastructure Stack
 * Creates all AWS resources needed for the platform
 */
export class CloudForgeAIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ========================================
    // DynamoDB Tables
    // ========================================

    // Users table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'cloudforge-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    })

    // Diagrams table with version history
    const diagramsTable = new dynamodb.Table(this, 'DiagramsTable', {
      tableName: 'cloudforge-diagrams',
      partitionKey: { name: 'diagramId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    })

    // GSI for querying diagrams by user
    diagramsTable.addGlobalSecondaryIndex({
      indexName: 'UserDiagramsIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'updatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Deployments table
    const deploymentsTable = new dynamodb.Table(this, 'DeploymentsTable', {
      tableName: 'cloudforge-deployments',
      partitionKey: {
        name: 'deploymentId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Can be recreated
      timeToLiveAttribute: 'ttl',
    })

    // GSI for querying deployments by user
    deploymentsTable.addGlobalSecondaryIndex({
      indexName: 'UserDeploymentsIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // ========================================
    // S3 Buckets
    // ========================================

    // Diagrams bucket
    const diagramsBucket = new s3.Bucket(this, 'DiagramsBucket', {
      bucketName: `cloudforge-diagrams-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    })

    // Templates bucket
    const templatesBucket = new s3.Bucket(this, 'TemplatesBucket', {
      bucketName: `cloudforge-templates-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(365),
        },
      ],
    })

    // ========================================
    // Cognito User Pool
    // ========================================

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'cloudforge-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    const userPoolClient = userPool.addClient('WebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(24),
      idTokenValidity: cdk.Duration.hours(24),
      refreshTokenValidity: cdk.Duration.days(30),
    })

    // ========================================
    // Lambda Layer for Shared Code
    // ========================================

    // Shared layer with utilities and AWS SDK clients
    // Build with: npm run build:layer
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared utilities, types, and AWS SDK clients for CloudForge AI',
      layerVersionName: 'cloudforge-shared-layer',
    })

    // ========================================
    // API Gateway
    // ========================================

    const api = new apigateway.RestApi(this, 'CloudForgeAPI', {
      restApiName: 'CloudForge AI API',
      description: 'API for CloudForge AI platform',
      deployOptions: {
        stageName: 'prod',
        throttlingBurstLimit: 200, // Max concurrent requests
        throttlingRateLimit: 100, // 100 requests per second base limit
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.OFF, // Disabled for initial deployment
        dataTraceEnabled: false, // Don't log full request/response (PII)
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // TODO: Restrict in production
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        maxAge: cdk.Duration.hours(1),
      },
    })

    // Cognito authorizer for protected routes
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
        authorizerName: 'CloudForgeCognitoAuthorizer',
        identitySource: 'method.request.header.Authorization',
      }
    )

    // ========================================
    // Auth Lambda Functions
    // ========================================

    // Environment variables for auth Lambdas
    const authEnv = {
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
      DYNAMODB_USERS_TABLE: usersTable.tableName,
      LOG_LEVEL: 'INFO',
    }

    // Sign up Lambda
    const signUpLambda = new lambda.Function(this, 'SignUpFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambdas/auth/sign-up.handler',
      code: lambda.Code.fromAsset('src'),
      environment: authEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [sharedLayer],
    })

    // Sign in Lambda
    const signInLambda = new lambda.Function(this, 'SignInFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambdas/auth/sign-in.handler',
      code: lambda.Code.fromAsset('src'),
      environment: authEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [sharedLayer],
    })

    // Sign out Lambda
    const signOutLambda = new lambda.Function(this, 'SignOutFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambdas/auth/sign-out.handler',
      code: lambda.Code.fromAsset('src'),
      environment: authEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [sharedLayer],
    })

    // Refresh token Lambda
    const refreshTokenLambda = new lambda.Function(
      this,
      'RefreshTokenFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/auth/refresh-token.handler',
        code: lambda.Code.fromAsset('src'),
        environment: authEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // Verify email Lambda
    const verifyEmailLambda = new lambda.Function(
      this,
      'VerifyEmailFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/auth/verify-email.handler',
        code: lambda.Code.fromAsset('src'),
        environment: authEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // Resend verification code Lambda
    const resendCodeLambda = new lambda.Function(
      this,
      'ResendCodeFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/auth/resend-code.handler',
        code: lambda.Code.fromAsset('src'),
        environment: authEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // Grant Cognito permissions to Lambda functions
    userPool.grant(
      signUpLambda,
      'cognito-idp:SignUp',
      'cognito-idp:ConfirmSignUp'
    )
    userPool.grant(
      signInLambda,
      'cognito-idp:InitiateAuth',
      'cognito-idp:RespondToAuthChallenge'
    )
    userPool.grant(signOutLambda, 'cognito-idp:GlobalSignOut')
    userPool.grant(refreshTokenLambda, 'cognito-idp:InitiateAuth')
    userPool.grant(verifyEmailLambda, 'cognito-idp:ConfirmSignUp')
    userPool.grant(
      resendCodeLambda,
      'cognito-idp:ResendConfirmationCode'
    )

    // Grant DynamoDB permissions for rate limiting in resend-code Lambda
    usersTable.grantReadWriteData(resendCodeLambda)

    // ========================================
    // AI Engine Lambda Function
    // ========================================

    // Environment variables for AI Lambda
    const aiEnv = {
      BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
      BEDROCK_REGION: process.env.BEDROCK_REGION || 'us-east-1',
      DYNAMODB_USERS_TABLE: usersTable.tableName,
      LOG_LEVEL: 'INFO',
    }

    // AI Architecture Generation Lambda
    const generateArchitectureLambda = new lambda.Function(
      this,
      'GenerateArchitectureFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/ai-engine/generate-architecture.handler',
        code: lambda.Code.fromAsset('src'),
        environment: aiEnv,
        timeout: cdk.Duration.seconds(30), // 30s for AI generation
        memorySize: 1024, // More memory for JSON parsing
        layers: [sharedLayer],
      }
    )

    // Grant Bedrock permissions (foundation models + inference profiles, all regions)
    // Note: Inference profiles may route to different regions, so we allow all regions
    generateArchitectureLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:*::foundation-model/*`,
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      })
    )

    // Grant AWS Marketplace permissions for model access
    generateArchitectureLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aws-marketplace:ViewSubscriptions', 'aws-marketplace:Subscribe'],
        resources: ['*'],
      })
    )

    // ========================================
    // Diagram Management Lambda Functions
    // ========================================

    // Environment variables for diagram Lambdas
    const diagramEnv = {
      DYNAMODB_DIAGRAMS_TABLE: diagramsTable.tableName,
      S3_DIAGRAMS_BUCKET: diagramsBucket.bucketName,
      LOG_LEVEL: 'INFO',
    }

    // Save diagram Lambda
    const saveDiagramLambda = new lambda.Function(
      this,
      'SaveDiagramFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/api/save-diagram.handler',
        code: lambda.Code.fromAsset('src'),
        environment: diagramEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Get diagram Lambda
    const getDiagramLambda = new lambda.Function(
      this,
      'GetDiagramFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/api/get-diagram.handler',
        code: lambda.Code.fromAsset('src'),
        environment: diagramEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // List diagrams Lambda
    const listDiagramsLambda = new lambda.Function(
      this,
      'ListDiagramsFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/api/list-diagrams.handler',
        code: lambda.Code.fromAsset('src'),
        environment: diagramEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // Delete diagram Lambda
    const deleteDiagramLambda = new lambda.Function(
      this,
      'DeleteDiagramFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/api/delete-diagram.handler',
        code: lambda.Code.fromAsset('src'),
        environment: diagramEnv,
        timeout: cdk.Duration.seconds(15),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Grant DynamoDB permissions
    diagramsTable.grantReadWriteData(saveDiagramLambda)
    diagramsTable.grantReadData(getDiagramLambda)
    diagramsTable.grantReadData(listDiagramsLambda)
    diagramsTable.grantReadWriteData(deleteDiagramLambda)

    // Grant S3 permissions
    diagramsBucket.grantReadWrite(saveDiagramLambda)
    diagramsBucket.grantRead(getDiagramLambda)
    diagramsBucket.grantReadWrite(deleteDiagramLambda)

    // ========================================
    // CloudFormation Generation Lambda Functions
    // ========================================

    // Environment variables for CloudFormation Lambda
    const cfnEnv = {
      LOG_LEVEL: 'INFO',
    }

    // Generate CloudFormation Lambda
    const generateCloudFormationLambda = new lambda.Function(
      this,
      'GenerateCloudFormationFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/generate-cloudformation.handler',
        code: lambda.Code.fromAsset('src'),
        environment: cfnEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // ========================================
    // AWS Connection Lambda Functions
    // ========================================

    // Environment variables for AWS connection Lambdas
    const awsConnectionEnv = {
      LOG_LEVEL: 'INFO',
    }

    // Connect AWS Lambda
    const connectAWSLambda = new lambda.Function(
      this,
      'ConnectAWSFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/aws-connection/connect-aws.handler',
        code: lambda.Code.fromAsset('src'),
        environment: awsConnectionEnv,
        timeout: cdk.Duration.seconds(15),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Get connection Lambda
    const getConnectionLambda = new lambda.Function(
      this,
      'GetConnectionFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/aws-connection/get-connection.handler',
        code: lambda.Code.fromAsset('src'),
        environment: awsConnectionEnv,
        timeout: cdk.Duration.seconds(5),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // Refresh connection Lambda
    const refreshConnectionLambda = new lambda.Function(
      this,
      'RefreshConnectionFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/aws-connection/refresh-connection.handler',
        code: lambda.Code.fromAsset('src'),
        environment: awsConnectionEnv,
        timeout: cdk.Duration.seconds(15),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Disconnect AWS Lambda
    const disconnectAWSLambda = new lambda.Function(
      this,
      'DisconnectAWSFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/aws-connection/disconnect-aws.handler',
        code: lambda.Code.fromAsset('src'),
        environment: awsConnectionEnv,
        timeout: cdk.Duration.seconds(5),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // Grant STS permissions for AssumeRole
    connectAWSLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: ['*'], // User provides the role ARN
      })
    )

    refreshConnectionLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: ['*'], // User provides the role ARN
      })
    )

    // Grant Secrets Manager permissions
    // Pattern: cloudforge/connection/*
    const secretsPattern = `arn:aws:secretsmanager:${this.region}:${this.account}:secret:cloudforge/connection/*`

    connectAWSLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:CreateSecret',
          'secretsmanager:UpdateSecret',
          'secretsmanager:DescribeSecret',
          'secretsmanager:TagResource',
        ],
        resources: [secretsPattern],
      })
    )

    getConnectionLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretsPattern],
      })
    )

    refreshConnectionLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
          'secretsmanager:UpdateSecret',
        ],
        resources: [secretsPattern],
      })
    )

    disconnectAWSLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:DeleteSecret'],
        resources: [secretsPattern],
      })
    )

    // ========================================
    // API Gateway Routes
    // ========================================

    // Auth routes (public - no authorization)
    const authResource = api.root.addResource('auth')

    authResource.addResource('signup').addMethod(
      'POST',
      new apigateway.LambdaIntegration(signUpLambda),
      {
        methodResponses: [{ statusCode: '200' }, { statusCode: '400' }],
      }
    )

    authResource.addResource('signin').addMethod(
      'POST',
      new apigateway.LambdaIntegration(signInLambda),
      {
        methodResponses: [{ statusCode: '200' }, { statusCode: '401' }],
      }
    )

    authResource.addResource('signout').addMethod(
      'POST',
      new apigateway.LambdaIntegration(signOutLambda),
      {
        methodResponses: [{ statusCode: '200' }, { statusCode: '401' }],
      }
    )

    authResource.addResource('refresh').addMethod(
      'POST',
      new apigateway.LambdaIntegration(refreshTokenLambda),
      {
        methodResponses: [{ statusCode: '200' }, { statusCode: '401' }],
      }
    )

    authResource.addResource('verify').addMethod(
      'POST',
      new apigateway.LambdaIntegration(verifyEmailLambda),
      {
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '404' },
          { statusCode: '429' },
        ],
      }
    )

    authResource.addResource('resend-code').addMethod(
      'POST',
      new apigateway.LambdaIntegration(resendCodeLambda),
      {
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '404' },
          { statusCode: '429' },
        ],
      }
    )

    // API routes (protected - require authorization)
    const apiResource = api.root.addResource('api')
    const architecturesResource = apiResource.addResource('architectures')

    // POST /api/architectures/generate - Generate architecture from description
    architecturesResource.addResource('generate').addMethod(
      'POST',
      new apigateway.LambdaIntegration(generateArchitectureLambda, {
        timeout: cdk.Duration.seconds(29), // Slightly less than Lambda timeout
      }),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '429' },
          { statusCode: '500' },
        ],
      }
    )

    // Diagram management routes
    const diagramsResource = apiResource.addResource('diagrams')

    // POST /api/diagrams - Save diagram
    diagramsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(saveDiagramLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '500' },
        ],
      }
    )

    // GET /api/diagrams - List diagrams
    diagramsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listDiagramsLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '500' },
        ],
      }
    )

    // GET /api/diagrams/{diagramId} - Get diagram
    const diagramResource = diagramsResource.addResource('{diagramId}')
    diagramResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getDiagramLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '403' },
          { statusCode: '404' },
          { statusCode: '500' },
        ],
      }
    )

    // DELETE /api/diagrams/{diagramId} - Delete diagram
    diagramResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteDiagramLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '403' },
          { statusCode: '404' },
          { statusCode: '500' },
        ],
      }
    )

    // CloudFormation generation routes
    const cloudformationResource = apiResource.addResource('cloudformation')

    // POST /api/cloudformation/generate - Generate CloudFormation from architecture
    cloudformationResource.addResource('generate').addMethod(
      'POST',
      new apigateway.LambdaIntegration(generateCloudFormationLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '500' },
        ],
      }
    )

    // AWS Connection routes
    const awsConnectionResource = apiResource.addResource('aws-connection')

    // POST /api/aws-connection/connect - Connect AWS account
    awsConnectionResource.addResource('connect').addMethod(
      'POST',
      new apigateway.LambdaIntegration(connectAWSLambda, {
        timeout: cdk.Duration.seconds(14),
      }),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '403' },
          { statusCode: '500' },
        ],
      }
    )

    // GET /api/aws-connection/status - Get connection status
    awsConnectionResource.addResource('status').addMethod(
      'GET',
      new apigateway.LambdaIntegration(getConnectionLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '401' },
          { statusCode: '404' },
          { statusCode: '500' },
        ],
      }
    )

    // POST /api/aws-connection/refresh - Refresh connection credentials
    awsConnectionResource.addResource('refresh').addMethod(
      'POST',
      new apigateway.LambdaIntegration(refreshConnectionLambda, {
        timeout: cdk.Duration.seconds(14),
      }),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '401' },
          { statusCode: '403' },
          { statusCode: '404' },
          { statusCode: '500' },
        ],
      }
    )

    // DELETE /api/aws-connection/disconnect - Disconnect AWS account
    awsConnectionResource.addResource('disconnect').addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(disconnectAWSLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '401' },
          { statusCode: '500' },
        ],
      }
    )

    // Add Gateway Responses to include CORS headers for auth failures
    api.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'OPTIONS,POST,GET,PUT,DELETE'",
      },
    })

    api.addGatewayResponse('AccessDenied', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
        'Access-Control-Allow-Methods': "'OPTIONS,POST,GET,PUT,DELETE'",
      },
    })

    // ========================================
    // API Gateway Usage Plan & Rate Limiting
    // ========================================

    // Create API key for tracking (can be extended for per-user keys)
    const apiKey = api.addApiKey('CloudForgeAPIKey', {
      apiKeyName: 'cloudforge-api-key',
      description: 'API key for CloudForge AI',
    })

    // Create usage plan with rate limiting
    const usagePlan = api.addUsagePlan('CloudForgeUsagePlan', {
      name: 'CloudForge Standard Plan',
      description: 'Usage plan with 100 req/min per user rate limit',
      throttle: {
        rateLimit: 100, // 100 requests per second per user
        burstLimit: 200, // Max 200 concurrent requests
      },
      quota: {
        limit: 10000, // 10,000 requests per day per user
        period: apigateway.Period.DAY,
      },
    })

    // Associate usage plan with API stage
    usagePlan.addApiStage({
      stage: api.deploymentStage,
    })

    // Associate API key with usage plan
    usagePlan.addApiKey(apiKey)

    // ========================================
    // Deployment Pipeline - Step Functions & Lambda Functions
    // ========================================

    // Environment variables for deployment Lambdas
    const deploymentEnv = {
      DEPLOYMENTS_TABLE: deploymentsTable.tableName,
      LOG_LEVEL: 'INFO',
    }

    // Validate template Lambda
    const validateTemplateLambda = new lambda.Function(
      this,
      'ValidateTemplateFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/validate-template.handler',
        code: lambda.Code.fromAsset('src'),
        environment: deploymentEnv,
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Assume role Lambda
    const assumeRoleLambda = new lambda.Function(
      this,
      'AssumeRoleFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/assume-role.handler',
        code: lambda.Code.fromAsset('src'),
        environment: deploymentEnv,
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Create stack Lambda
    const createStackLambda = new lambda.Function(
      this,
      'CreateStackFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/create-stack.handler',
        code: lambda.Code.fromAsset('src'),
        environment: deploymentEnv,
        timeout: cdk.Duration.seconds(60),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Poll status Lambda
    const pollStatusLambda = new lambda.Function(
      this,
      'PollStatusFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/poll-status.handler',
        code: lambda.Code.fromAsset('src'),
        environment: deploymentEnv,
        timeout: cdk.Duration.seconds(60),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Grant DynamoDB permissions to deployment Lambdas
    deploymentsTable.grantReadWriteData(validateTemplateLambda)
    deploymentsTable.grantReadWriteData(assumeRoleLambda)
    deploymentsTable.grantReadWriteData(createStackLambda)
    deploymentsTable.grantReadWriteData(pollStatusLambda)

    // Grant CloudFormation permissions
    validateTemplateLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudformation:ValidateTemplate'],
        resources: ['*'],
      })
    )

    // Grant CloudFormation read permissions to poll-status Lambda
    pollStatusLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudformation:DescribeStacks',
          'cloudformation:DescribeStackEvents',
          'cloudformation:DescribeStackResources',
        ],
        resources: ['*'],
      })
    )

    // Grant STS and Secrets Manager permissions to assume role Lambda
    assumeRoleLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: ['*'],
      })
    )

    assumeRoleLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretsPattern],
      })
    )

    // Create stack and poll status Lambdas don't need extra permissions
    // They use temporary credentials passed from assume role step

    // Define Step Functions state machine
    const validateTask = new tasks.LambdaInvoke(this, 'ValidateTemplate', {
      lambdaFunction: validateTemplateLambda,
      outputPath: '$.Payload',
    })

    const assumeRoleTask = new tasks.LambdaInvoke(this, 'AssumeRole', {
      lambdaFunction: assumeRoleLambda,
      outputPath: '$.Payload',
    })

    const createStackTask = new tasks.LambdaInvoke(this, 'CreateStack', {
      lambdaFunction: createStackLambda,
      outputPath: '$.Payload',
    })

    const pollStatusTask = new tasks.LambdaInvoke(this, 'PollStatus', {
      lambdaFunction: pollStatusLambda,
      outputPath: '$.Payload',
    })

    // Wait state for polling (5 seconds between polls)
    const waitState = new sfn.Wait(this, 'WaitForStackProgress', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(5)),
    })

    // Check if stack is complete
    const isComplete = new sfn.Choice(this, 'IsStackComplete')
      .when(sfn.Condition.booleanEquals('$.isComplete', true), new sfn.Succeed(this, 'DeploymentSucceeded'))
      .otherwise(waitState)

    // Chain: Poll → Check → Wait (loop back to Poll)
    pollStatusTask.next(isComplete)
    waitState.next(pollStatusTask)

    // Main deployment workflow
    const definition = validateTask.next(
      new sfn.Choice(this, 'IsValidationSuccessful')
        .when(sfn.Condition.booleanEquals('$.isValid', true), assumeRoleTask)
        .otherwise(
          new sfn.Fail(this, 'ValidationFailed', {
            error: 'TemplateValidationError',
            cause: 'CloudFormation template validation failed',
          })
        )
    )

    assumeRoleTask.next(createStackTask).next(pollStatusTask)

    // Create Step Functions state machine
    const stateMachine = new sfn.StateMachine(this, 'DeploymentStateMachine', {
      stateMachineName: 'cloudforge-deployment-pipeline',
      definition: definition,
      timeout: cdk.Duration.hours(2), // Max 2 hour deployment
      tracingEnabled: true,
    })

    // Start deployment Lambda (API)
    const startDeploymentLambda = new lambda.Function(
      this,
      'StartDeploymentFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/start-deployment.handler',
        code: lambda.Code.fromAsset('src'),
        environment: {
          ...deploymentEnv,
          STATE_MACHINE_ARN: stateMachine.stateMachineArn,
        },
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        layers: [sharedLayer],
      }
    )

    // Get deployment Lambda (API)
    const getDeploymentLambda = new lambda.Function(
      this,
      'GetDeploymentFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/get-deployment.handler',
        code: lambda.Code.fromAsset('src'),
        environment: deploymentEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // List deployments Lambda (API)
    const listDeploymentsLambda = new lambda.Function(
      this,
      'ListDeploymentsFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'lambdas/deployment/list-deployments.handler',
        code: lambda.Code.fromAsset('src'),
        environment: deploymentEnv,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        layers: [sharedLayer],
      }
    )

    // Grant permissions
    deploymentsTable.grantReadWriteData(startDeploymentLambda)
    deploymentsTable.grantReadData(getDeploymentLambda)
    deploymentsTable.grantReadData(listDeploymentsLambda)
    stateMachine.grantStartExecution(startDeploymentLambda)

    // Deployment API routes
    const deploymentsResource = apiResource.addResource('deployments', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    })

    const startDeploymentResource = deploymentsResource.addResource('start', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    })

    // POST /api/deployments/start - Start deployment
    startDeploymentResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(startDeploymentLambda, {
        timeout: cdk.Duration.seconds(29),
      }),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '202' },
          { statusCode: '400' },
          { statusCode: '401' },
          { statusCode: '500' },
        ],
      }
    )

    // GET /api/deployments - List deployments
    deploymentsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(listDeploymentsLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '401' },
          { statusCode: '500' },
        ],
      }
    )

    // GET /api/deployments/{id} - Get deployment status
    const deploymentResource = deploymentsResource.addResource('{id}', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    })
    deploymentResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getDeploymentLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '401' },
          { statusCode: '403' },
          { statusCode: '404' },
          { statusCode: '500' },
        ],
      }
    )

    // ========================================
    // Outputs
    // ========================================

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'CloudForgeUserPoolId',
    })

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'CloudForgeUserPoolClientId',
    })

    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'CloudForgeAPIEndpoint',
    })

    new cdk.CfnOutput(this, 'DiagramsBucketName', {
      value: diagramsBucket.bucketName,
      description: 'S3 bucket for diagrams',
      exportName: 'CloudForgeDiagramsBucket',
    })

    new cdk.CfnOutput(this, 'TemplatesBucketName', {
      value: templatesBucket.bucketName,
      description: 'S3 bucket for templates',
      exportName: 'CloudForgeTemplatesBucket',
    })

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB Users table',
      exportName: 'CloudForgeUsersTable',
    })

    new cdk.CfnOutput(this, 'DiagramsTableName', {
      value: diagramsTable.tableName,
      description: 'DynamoDB Diagrams table',
      exportName: 'CloudForgeDiagramsTable',
    })

    new cdk.CfnOutput(this, 'DeploymentsTableName', {
      value: deploymentsTable.tableName,
      description: 'DynamoDB Deployments table',
      exportName: 'CloudForgeDeploymentsTable',
    })

    new cdk.CfnOutput(this, 'DeploymentStateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'Step Functions state machine ARN for deployment pipeline',
      exportName: 'CloudForgeDeploymentStateMachine',
    })
  }
}
