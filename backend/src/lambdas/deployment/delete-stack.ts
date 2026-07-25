import { CloudFormationClient, DeleteStackCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

/**
 * API Lambda: Delete CloudFormation stack
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Delete stack request:', {
    path: event.path,
    method: event.httpMethod,
  });

  try {
    // Extract userId from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Missing user authentication',
        }),
      };
    }

    // Extract deploymentId from path parameters
    const deploymentId = event.pathParameters?.id;
    if (!deploymentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Missing deployment ID',
        }),
      };
    }

    // Get deployment from DynamoDB
    const getResponse = await dynamoClient.send(
      new GetItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: deploymentId },
        },
      })
    );

    if (!getResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'NotFound',
          message: 'Deployment not found',
        }),
      };
    }

    const deployment = unmarshall(getResponse.Item);

    // Verify user owns this deployment
    if (deployment.userId !== userId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have access to this deployment',
        }),
      };
    }

    // Check if stack exists and is in a deletable state
    if (!deployment.stackId) {
      // Stack was never created (e.g., VALIDATION_FAILED)
      // Just mark the deployment record as deleted
      await dynamoClient.send(
        new UpdateItemCommand({
          TableName: DEPLOYMENTS_TABLE,
          Key: {
            deploymentId: { S: deploymentId },
          },
          UpdateExpression: 'SET #status = :status, deletedAt = :now',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': { S: 'DELETED' },
            ':now': { S: new Date().toISOString() },
          },
        })
      );

      console.log('Deployment record marked as deleted (no stack to delete):', {
        deploymentId,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          deploymentId,
          status: 'DELETED',
          message: 'Deployment record deleted successfully',
        }),
      };
    }

    // Create CloudFormation client (uses Lambda's IAM role)
    const cfnClient = new CloudFormationClient({
      region: deployment.region || 'us-east-1',
    });

    // Delete the stack
    await cfnClient.send(
      new DeleteStackCommand({
        StackName: deployment.stackId,
      })
    );

    console.log('Stack deletion initiated:', {
      deploymentId,
      stackId: deployment.stackId,
    });

    // Update deployment status
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: deploymentId },
        },
        UpdateExpression: 'SET #status = :status, deletingAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'DELETING' },
          ':now': { S: new Date().toISOString() },
        },
      })
    );

    return {
      statusCode: 202, // Accepted
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deploymentId,
        stackId: deployment.stackId,
        status: 'DELETING',
        message: 'Stack deletion initiated successfully',
      }),
    };
  } catch (error: any) {
    console.error('Failed to delete stack:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: error.message || 'Failed to delete stack',
      }),
    };
  }
};
