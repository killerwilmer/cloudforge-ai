import {
  CloudFormationClient,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
  StackStatus,
} from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

export interface PollStatusInput {
  deploymentId: string;
  userId: string;
  stackName: string;
  stackId: string;
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
}

export interface PollStatusOutput {
  deploymentId: string;
  userId: string;
  stackName: string;
  stackId: string;
  region: string;
  status: string;
  isComplete: boolean;
  isSuccess: boolean;
  statusReason?: string;
  resources?: Array<{
    logicalId: string;
    physicalId?: string;
    type: string;
    status: string;
    timestamp: string;
  }>;
}

/**
 * Step Functions handler: Poll CloudFormation stack status
 * Returns when stack reaches terminal state or continues polling
 */
export const handler = async (event: PollStatusInput): Promise<PollStatusOutput> => {
  console.log('Polling stack status:', {
    deploymentId: event.deploymentId,
    stackName: event.stackName,
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
    // Describe stack
    const describeStacksResponse = await cfnClient.send(
      new DescribeStacksCommand({
        StackName: event.stackId,
      })
    );

    const stack = describeStacksResponse.Stacks?.[0];
    if (!stack) {
      throw new Error('Stack not found');
    }

    const stackStatus = stack.StackStatus!;
    console.log('Stack status:', stackStatus);

    // Get recent stack events for resource status
    const eventsResponse = await cfnClient.send(
      new DescribeStackEventsCommand({
        StackName: event.stackId,
      })
    );

    const resources = eventsResponse.StackEvents?.slice(0, 50) // Last 50 events
      .filter((event) => event.LogicalResourceId !== event.StackName) // Exclude stack itself
      .map((event) => ({
        logicalId: event.LogicalResourceId!,
        physicalId: event.PhysicalResourceId,
        type: event.ResourceType!,
        status: event.ResourceStatus!,
        timestamp: event.Timestamp!.toISOString(),
      }));

    // Determine if stack is in terminal state
    const terminalStates: StackStatus[] = [
      StackStatus.CREATE_COMPLETE,
      StackStatus.CREATE_FAILED,
      StackStatus.ROLLBACK_COMPLETE,
      StackStatus.ROLLBACK_FAILED,
      StackStatus.DELETE_COMPLETE,
      StackStatus.DELETE_FAILED,
      StackStatus.UPDATE_COMPLETE,
      StackStatus.UPDATE_FAILED,
      StackStatus.UPDATE_ROLLBACK_COMPLETE,
      StackStatus.UPDATE_ROLLBACK_FAILED,
    ];

    const successStates: StackStatus[] = [
      StackStatus.CREATE_COMPLETE,
      StackStatus.UPDATE_COMPLETE,
    ];

    const isComplete = terminalStates.includes(stackStatus);
    const isSuccess = successStates.includes(stackStatus);

    // Update deployment status in DynamoDB
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression: 'SET #status = :status, stackStatus = :stackStatus, lastPolledAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: isComplete ? (isSuccess ? 'COMPLETED' : 'FAILED') : 'IN_PROGRESS' },
          ':stackStatus': { S: stackStatus },
          ':now': { S: new Date().toISOString() },
        },
      })
    );

    // If complete, update final status
    if (isComplete) {
      await dynamoClient.send(
        new UpdateItemCommand({
          TableName: DEPLOYMENTS_TABLE,
          Key: {
            deploymentId: { S: event.deploymentId },
          },
          UpdateExpression: isSuccess
            ? 'SET completedAt = :now, stackOutputs = :outputs'
            : 'SET failedAt = :now, errorMessage = :error',
          ExpressionAttributeValues: isSuccess
            ? {
                ':now': { S: new Date().toISOString() },
                ':outputs': { S: JSON.stringify(stack.Outputs || []) },
              }
            : {
                ':now': { S: new Date().toISOString() },
                ':error': { S: stack.StackStatusReason || 'Stack deployment failed' },
              },
        })
      );
    }

    return {
      deploymentId: event.deploymentId,
      userId: event.userId,
      stackName: event.stackName,
      stackId: event.stackId,
      region: event.region,
      status: stackStatus,
      isComplete,
      isSuccess,
      statusReason: stack.StackStatusReason,
      resources,
    };
  } catch (error: any) {
    console.error('Failed to poll stack status:', error);

    const errorMessage = error.message || 'Unknown error polling stack status';

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
          ':status': { S: 'POLL_STATUS_FAILED' },
          ':now': { S: new Date().toISOString() },
          ':error': { S: errorMessage },
        },
      })
    );

    throw error;
  }
};
