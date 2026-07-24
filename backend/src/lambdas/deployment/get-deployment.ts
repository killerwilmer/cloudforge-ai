import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

/**
 * API Lambda: Get deployment status by ID
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Get deployment request:', {
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
    const response = await dynamoClient.send(
      new GetItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: deploymentId },
        },
      })
    );

    if (!response.Item) {
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

    const deployment = unmarshall(response.Item);

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

    console.log('Deployment retrieved:', {
      deploymentId,
      status: deployment.status,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deployment,
      }),
    };
  } catch (error: any) {
    console.error('Failed to get deployment:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: error.message || 'Failed to get deployment',
      }),
    };
  }
};
