import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamoClient = new DynamoDBClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

/**
 * API Lambda: List all deployments for the authenticated user
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('List deployments request:', {
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

    // Query deployments by userId using GSI
    const response = await dynamoClient.send(
      new QueryCommand({
        TableName: DEPLOYMENTS_TABLE,
        IndexName: 'UserDeploymentsIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': { S: userId },
        },
        ScanIndexForward: false, // Sort by startedAt DESC (most recent first)
        Limit: 50, // Limit to 50 most recent deployments
      })
    );

    const deployments = response.Items?.map((item) => unmarshall(item)) || [];

    console.log('Deployments retrieved:', {
      userId,
      count: deployments.length,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deployments,
        count: deployments.length,
      }),
    };
  } catch (error: any) {
    console.error('Failed to list deployments:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: error.message || 'Failed to list deployments',
      }),
    };
  }
};
