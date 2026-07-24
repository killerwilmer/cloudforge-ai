import { CloudFormationClient, CreateStackCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

export interface CreateStackInput {
  deploymentId: string;
  userId: string;
  templateBody: string;
  stackName: string;
  region: string;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
  capabilities?: string[];
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
}

export interface CreateStackOutput {
  deploymentId: string;
  userId: string;
  stackName: string;
  stackId: string;
  region: string;
}

/**
 * Step Functions handler: Create CloudFormation stack in user's AWS account
 */
export const handler = async (event: CreateStackInput): Promise<CreateStackOutput> => {
  console.log('Creating CloudFormation stack:', {
    deploymentId: event.deploymentId,
    stackName: event.stackName,
    region: event.region,
  });

  // Create CloudFormation client with user's credentials
  const cfnClient = new CloudFormationClient({
    region: event.region,
    credentials: {
      accessKeyId: event.credentials.accessKeyId,
      secretAccessKey: event.credentials.secretAccessKey,
      sessionToken: event.credentials.sessionToken,
    },
  });

  try {
    // Update deployment status
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression: 'SET #status = :status, creatingStackAt = :now, stackName = :stackName, region = :region',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'CREATING_STACK' },
          ':now': { S: new Date().toISOString() },
          ':stackName': { S: event.stackName },
          ':region': { S: event.region },
        },
      })
    );

    // Create CloudFormation stack
    const createStackCommand = new CreateStackCommand({
      StackName: event.stackName,
      TemplateBody: event.templateBody,
      Parameters: event.parameters,
      Capabilities: (event.capabilities as any) || ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
      Tags: [
        {
          Key: 'ManagedBy',
          Value: 'CloudForge',
        },
        {
          Key: 'DeploymentId',
          Value: event.deploymentId,
        },
      ],
      OnFailure: 'ROLLBACK', // Automatically rollback on failure
      TimeoutInMinutes: 60, // 1 hour timeout
    });

    const createStackResponse = await cfnClient.send(createStackCommand);

    if (!createStackResponse.StackId) {
      throw new Error('Failed to create stack: No stack ID returned');
    }

    console.log('Stack creation initiated:', {
      deploymentId: event.deploymentId,
      stackId: createStackResponse.StackId,
    });

    // Update deployment with stack ID
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression: 'SET #status = :status, stackId = :stackId, stackCreatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'STACK_CREATING' },
          ':stackId': { S: createStackResponse.StackId },
          ':now': { S: new Date().toISOString() },
        },
      })
    );

    return {
      deploymentId: event.deploymentId,
      userId: event.userId,
      stackName: event.stackName,
      stackId: createStackResponse.StackId,
      region: event.region,
    };
  } catch (error: any) {
    console.error('Failed to create stack:', error);

    const errorMessage = error.message || 'Unknown error creating stack';

    // Update deployment status to failed
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression:
          'SET #status = :status, failedAt = :now, errorMessage = :error',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'CREATE_STACK_FAILED' },
          ':now': { S: new Date().toISOString() },
          ':error': { S: errorMessage },
        },
      })
    );

    throw error;
  }
};
