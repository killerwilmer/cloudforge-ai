import { mockClient } from 'aws-sdk-client-mock';
import { CloudFormationClient, ValidateTemplateCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { handler } from './validate-template';

const cfnMock = mockClient(CloudFormationClient);
const dynamoMock = mockClient(DynamoDBClient);

process.env.DEPLOYMENTS_TABLE = 'test-deployments';

describe('validate-template Lambda', () => {
  beforeEach(() => {
    cfnMock.reset();
    dynamoMock.reset();
  });

  test('validates valid CloudFormation template successfully', async () => {
    cfnMock.on(ValidateTemplateCommand).resolves({
      Parameters: [
        { ParameterKey: 'EnvironmentName', DefaultValue: 'dev' },
        { ParameterKey: 'InstanceType', DefaultValue: 't3.micro' },
      ],
      Capabilities: ['CAPABILITY_IAM'],
    });
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-123',
      userId: 'user-456',
      templateBody: `
AWSTemplateFormatVersion: '2010-09-09'
Parameters:
  EnvironmentName:
    Type: String
    Default: dev
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
`,
    };

    const result = await handler(event);

    expect(result.isValid).toBe(true);
    expect(result.deploymentId).toBe('deploy-123');
    expect(result.parameters).toHaveLength(2);
    expect(result.parameters?.[0].ParameterKey).toBe('EnvironmentName');
    expect(result.capabilities).toEqual(['CAPABILITY_IAM']);

    // Verify DynamoDB was updated with VALIDATING then VALIDATED status
    const updateCalls = dynamoMock.commandCalls(UpdateItemCommand);
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[0].args[0].input.ExpressionAttributeValues?.[':status'].S).toBe('VALIDATING');
    expect(updateCalls[1].args[0].input.ExpressionAttributeValues?.[':status'].S).toBe('VALIDATED');
  });

  test('handles template with no parameters', async () => {
    cfnMock.on(ValidateTemplateCommand).resolves({
      Parameters: [],
      Capabilities: [],
    });
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-no-params',
      userId: 'user-123',
      templateBody: `
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  SimpleQueue:
    Type: AWS::SQS::Queue
`,
    };

    const result = await handler(event);

    expect(result.isValid).toBe(true);
    expect(result.parameters).toHaveLength(0);
    expect(result.capabilities).toHaveLength(0);
  });

  test('handles template with CAPABILITY_NAMED_IAM', async () => {
    cfnMock.on(ValidateTemplateCommand).resolves({
      Parameters: [],
      Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
    });
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-named-iam',
      userId: 'user-123',
      templateBody: 'test template with named IAM',
    };

    const result = await handler(event);

    expect(result.isValid).toBe(true);
    expect(result.capabilities).toContain('CAPABILITY_NAMED_IAM');
  });

  test('returns validation error for invalid template syntax', async () => {
    cfnMock.on(ValidateTemplateCommand).rejects(
      new Error('Template format error: JSON not well-formed')
    );
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-invalid',
      userId: 'user-123',
      templateBody: 'invalid { json',
    };

    const result = await handler(event);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('JSON not well-formed');

    // Verify DynamoDB was updated with VALIDATION_FAILED status
    const updateCalls = dynamoMock.commandCalls(UpdateItemCommand);
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[1].args[0].input.ExpressionAttributeValues?.[':status'].S).toBe(
      'VALIDATION_FAILED'
    );
  });

  test('returns error for template with invalid resource types', async () => {
    cfnMock.on(ValidateTemplateCommand).rejects(
      new Error('Template validation error: Resource type AWS::InvalidService::Resource does not exist')
    );
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-invalid-resource',
      userId: 'user-123',
      templateBody: `
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  BadResource:
    Type: AWS::InvalidService::Resource
`,
    };

    const result = await handler(event);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  test('returns error for template with circular dependencies', async () => {
    cfnMock.on(ValidateTemplateCommand).rejects(
      new Error('Circular dependency between resources')
    );
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-circular',
      userId: 'user-123',
      templateBody: 'template with circular deps',
    };

    const result = await handler(event);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Circular dependency');
  });

  test('handles CloudFormation service error', async () => {
    cfnMock.on(ValidateTemplateCommand).rejects(
      new Error('Service temporarily unavailable')
    );
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-service-error',
      userId: 'user-123',
      templateBody: 'test',
    };

    const result = await handler(event);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Service temporarily unavailable');
  });

  test('updates deployment status even when validation fails', async () => {
    cfnMock.on(ValidateTemplateCommand).rejects(new Error('Invalid template'));
    dynamoMock.on(UpdateItemCommand).resolves({});

    const event = {
      deploymentId: 'deploy-update-test',
      userId: 'user-123',
      templateBody: 'bad template',
    };

    await handler(event);

    // Verify DynamoDB was called twice (VALIDATING, then VALIDATION_FAILED)
    const updateCalls = dynamoMock.commandCalls(UpdateItemCommand);
    expect(updateCalls.length).toBe(2);
    expect(updateCalls[0].args[0].input.Key?.deploymentId.S).toBe('deploy-update-test');
    expect(updateCalls[1].args[0].input.UpdateExpression).toContain('errorMessage');
  });

  test('handles DynamoDB update failure gracefully', async () => {
    cfnMock.on(ValidateTemplateCommand).resolves({
      Parameters: [],
      Capabilities: [],
    });
    dynamoMock.on(UpdateItemCommand).rejects(new Error('DynamoDB error'));

    const event = {
      deploymentId: 'deploy-dynamo-error',
      userId: 'user-123',
      templateBody: 'test',
    };

    // Should throw error since DynamoDB update failed
    await expect(handler(event)).rejects.toThrow('DynamoDB error');
  });

  test('passes through template body unchanged', async () => {
    cfnMock.on(ValidateTemplateCommand).resolves({
      Parameters: [],
      Capabilities: [],
    });
    dynamoMock.on(UpdateItemCommand).resolves({});

    const templateBody = 'AWSTemplateFormatVersion: "2010-09-09"\nResources:\n  Test: {}';
    const event = {
      deploymentId: 'deploy-passthrough',
      userId: 'user-123',
      templateBody,
    };

    const result = await handler(event);

    expect(result.templateBody).toBe(templateBody);
  });
});
