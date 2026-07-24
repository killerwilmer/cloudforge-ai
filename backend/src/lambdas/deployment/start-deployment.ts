import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({});
const sfnClient = new SFNClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;

interface StartDeploymentRequest {
  templateBody: string;
  stackName: string;
  region: string;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
  diagramId?: string;
}

/**
 * API Lambda: Start a new deployment
 * Creates deployment record and starts Step Functions execution
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Start deployment request:', {
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

    // Parse request body
    const body: StartDeploymentRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.templateBody || !body.stackName || !body.region) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Missing required fields: templateBody, stackName, region',
        }),
      };
    }

    // Validate stack name format (alphanumeric and hyphens only, max 128 chars)
    const stackNameRegex = /^[a-zA-Z][-a-zA-Z0-9]*$/;
    if (!stackNameRegex.test(body.stackName) || body.stackName.length > 128) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'ValidationError',
          message:
            'Invalid stack name. Must start with a letter, contain only alphanumeric characters and hyphens, and be max 128 characters.',
        }),
      };
    }

    // Validate region format
    const regionRegex = /^[a-z]{2}-[a-z]+-\d{1}$/;
    if (!regionRegex.test(body.region)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'ValidationError',
          message: 'Invalid AWS region format (e.g., us-east-1)',
        }),
      };
    }

    // Generate deployment ID
    const deploymentId = randomUUID();
    const now = new Date().toISOString();

    // Create deployment record in DynamoDB
    await dynamoClient.send(
      new PutItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Item: {
          deploymentId: { S: deploymentId },
          userId: { S: userId },
          stackName: { S: body.stackName },
          region: { S: body.region },
          status: { S: 'INITIATED' },
          startedAt: { S: now },
          ...(body.diagramId && { diagramId: { S: body.diagramId } }),
          ttl: { N: String(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60) }, // 90 days TTL
        },
      })
    );

    // Start Step Functions execution
    const executionInput = {
      deploymentId,
      userId,
      templateBody: body.templateBody,
      stackName: body.stackName,
      region: body.region,
      parameters: body.parameters,
    };

    const executionResponse = await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: `deployment-${deploymentId}`,
        input: JSON.stringify(executionInput),
      })
    );

    console.log('Deployment started:', {
      deploymentId,
      executionArn: executionResponse.executionArn,
    });

    return {
      statusCode: 202, // Accepted
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        deploymentId,
        userId,
        stackName: body.stackName,
        region: body.region,
        status: 'INITIATED',
        startedAt: now,
        executionArn: executionResponse.executionArn,
      }),
    };
  } catch (error: any) {
    console.error('Failed to start deployment:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'InternalServerError',
        message: error.message || 'Failed to start deployment',
      }),
    };
  }
};
