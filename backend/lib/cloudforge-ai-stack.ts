import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'
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

    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('src/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Shared utilities and types for CloudForge AI',
    })

    // ========================================
    // API Gateway
    // ========================================

    const api = new apigateway.RestApi(this, 'CloudForgeAPI', {
      restApiName: 'CloudForge AI API',
      description: 'API for CloudForge AI platform',
      deployOptions: {
        stageName: 'prod',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    // Cognito authorizer (will be used for protected routes in later tasks)
    const _authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
      }
    )

    // ========================================
    // Auth Lambda Functions
    // ========================================

    // Environment variables for auth Lambdas
    const authEnv = {
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      AWS_REGION_OVERRIDE: this.region,
    }

    // Sign up Lambda
    const signUpLambda = new lambda.Function(this, 'SignUpFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'sign-up.handler',
      code: lambda.Code.fromAsset('src/lambdas/auth'),
      environment: authEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [sharedLayer],
    })

    // Sign in Lambda
    const signInLambda = new lambda.Function(this, 'SignInFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'sign-in.handler',
      code: lambda.Code.fromAsset('src/lambdas/auth'),
      environment: authEnv,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      layers: [sharedLayer],
    })

    // Sign out Lambda
    const signOutLambda = new lambda.Function(this, 'SignOutFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'sign-out.handler',
      code: lambda.Code.fromAsset('src/lambdas/auth'),
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
        handler: 'refresh-token.handler',
        code: lambda.Code.fromAsset('src/lambdas/auth'),
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
  }
}
