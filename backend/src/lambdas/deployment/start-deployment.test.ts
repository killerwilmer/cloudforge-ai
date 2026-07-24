import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { handler } from './start-deployment';

const dynamoMock = mockClient(DynamoDBClient);
const sfnMock = mockClient(SFNClient);

// Set environment variables
process.env.DEPLOYMENTS_TABLE = 'test-deployments';
process.env.STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-machine';

describe('start-deployment Lambda', () => {
  beforeEach(() => {
    dynamoMock.reset();
    sfnMock.reset();
  });

  const createEvent = (body: any, userId = 'test-user-123'): APIGatewayProxyEvent => ({
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/api/deployments/start',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        claims: {
          sub: userId,
        },
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/api/deployments/start',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/api/deployments/start',
    },
    resource: '/api/deployments/start',
  });

  test('successfully starts deployment with valid CloudFormation template', async () => {
    const validTemplate = `
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
`;

    dynamoMock.on(PutItemCommand).resolves({});
    sfnMock.on(StartExecutionCommand).resolves({
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-machine:deployment-123',
      startDate: new Date(),
    });

    const event = createEvent({
      templateBody: validTemplate,
      stackName: 'my-test-stack',
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.deploymentId).toBeDefined();
    expect(body.userId).toBe('test-user-123');
    expect(body.stackName).toBe('my-test-stack');
    expect(body.region).toBe('us-east-1');
    expect(body.status).toBe('INITIATED');
    expect(body.executionArn).toContain('execution');
  });

  test('starts deployment with parameters', async () => {
    dynamoMock.on(PutItemCommand).resolves({});
    sfnMock.on(StartExecutionCommand).resolves({
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-machine:deployment-456',
      startDate: new Date(),
    });

    const event = createEvent({
      templateBody: 'AWSTemplateFormatVersion: "2010-09-09"',
      stackName: 'parameterized-stack',
      region: 'us-west-2',
      parameters: [
        { ParameterKey: 'Environment', ParameterValue: 'production' },
        { ParameterKey: 'InstanceType', ParameterValue: 't3.medium' },
      ],
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body);
    expect(body.region).toBe('us-west-2');

    // Verify Step Functions was called with parameters
    const sfnCalls = sfnMock.commandCalls(StartExecutionCommand);
    expect(sfnCalls.length).toBe(1);
    const input = JSON.parse(sfnCalls[0].args[0].input!);
    expect(input.parameters).toHaveLength(2);
    expect(input.parameters[0].ParameterKey).toBe('Environment');
  });

  test('returns 401 when userId is missing (not authenticated)', async () => {
    const event = createEvent(
      {
        templateBody: 'test',
        stackName: 'test-stack',
        region: 'us-east-1',
      },
      undefined as any
    );
    event.requestContext.authorizer = {} as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 400 when templateBody is missing', async () => {
    const event = createEvent({
      stackName: 'test-stack',
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('ValidationError');
    expect(body.message).toContain('Missing required fields');
  });

  test('returns 400 when stackName is missing', async () => {
    const event = createEvent({
      templateBody: 'test template',
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('ValidationError');
  });

  test('returns 400 when region is missing', async () => {
    const event = createEvent({
      templateBody: 'test template',
      stackName: 'test-stack',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('ValidationError');
  });

  test('returns 400 for invalid stack name format', async () => {
    const event = createEvent({
      templateBody: 'test',
      stackName: '123-invalid-start', // Must start with letter
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('ValidationError');
    expect(body.message).toContain('Invalid stack name');
  });

  test('returns 400 for stack name with special characters', async () => {
    const event = createEvent({
      templateBody: 'test',
      stackName: 'my_stack@name!', // Only alphanumeric and hyphens allowed
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('ValidationError');
  });

  test('returns 400 for invalid region format', async () => {
    const event = createEvent({
      templateBody: 'test',
      stackName: 'my-stack',
      region: 'invalid-region',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('ValidationError');
    expect(body.message).toContain('Invalid AWS region format');
  });

  test('includes diagramId in deployment record when provided', async () => {
    dynamoMock.on(PutItemCommand).resolves({});
    sfnMock.on(StartExecutionCommand).resolves({
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-machine:deployment-789',
      startDate: new Date(),
    });

    const event = createEvent({
      templateBody: 'test',
      stackName: 'linked-stack',
      region: 'us-east-1',
      diagramId: 'diagram-abc-123',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(202);

    // Verify DynamoDB was called with diagramId
    const dynamoCalls = dynamoMock.commandCalls(PutItemCommand);
    expect(dynamoCalls.length).toBe(1);
    const item = dynamoCalls[0].args[0].input.Item;
    expect(item.diagramId).toBeDefined();
  });

  test('handles DynamoDB error gracefully', async () => {
    dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB connection failed'));

    const event = createEvent({
      templateBody: 'test',
      stackName: 'error-stack',
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('InternalServerError');
  });

  test('handles Step Functions error gracefully', async () => {
    dynamoMock.on(PutItemCommand).resolves({});
    sfnMock.on(StartExecutionCommand).rejects(new Error('State machine not found'));

    const event = createEvent({
      templateBody: 'test',
      stackName: 'sfn-error-stack',
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('InternalServerError');
  });

  test('sets TTL for automatic cleanup after 90 days', async () => {
    dynamoMock.on(PutItemCommand).resolves({});
    sfnMock.on(StartExecutionCommand).resolves({
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-machine:deployment-ttl',
      startDate: new Date(),
    });

    const event = createEvent({
      templateBody: 'test',
      stackName: 'ttl-stack',
      region: 'us-east-1',
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(202);

    // Verify TTL is set
    const dynamoCalls = dynamoMock.commandCalls(PutItemCommand);
    const item = dynamoCalls[0].args[0].input.Item;
    expect(item.ttl).toBeDefined();
    expect(item.ttl.N).toBeDefined();

    // TTL should be approximately 90 days from now
    const ttlValue = parseInt(item.ttl.N!);
    const now = Math.floor(Date.now() / 1000);
    const ninetyDays = 90 * 24 * 60 * 60;
    expect(ttlValue).toBeGreaterThan(now + ninetyDays - 60); // Allow 60s tolerance
    expect(ttlValue).toBeLessThan(now + ninetyDays + 60);
  });
});
