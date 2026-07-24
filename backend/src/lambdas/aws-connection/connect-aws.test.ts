import {
    CreateSecretCommand,
    SecretsManagerClient,
    UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from './connect-aws';

const stsMock = mockClient(STSClient);
const secretsMock = mockClient(SecretsManagerClient);

describe('connect-aws Lambda', () => {
  beforeEach(() => {
    stsMock.reset();
    secretsMock.reset();
  });

  const createMockEvent = (body: any): APIGatewayProxyEvent => {
    return {
      body: JSON.stringify(body),
      requestContext: {
        authorizer: {
          claims: {
            sub: 'test-user-123',
          },
        },
        requestId: 'test-request-id',
      },
    } as any;
  };

  it('should successfully connect AWS account with valid role ARN', async () => {
    const mockCredentials = {
      AccessKeyId: 'ASIA...',
      SecretAccessKey: 'secret...',
      SessionToken: 'token...',
      Expiration: new Date('2026-07-25T00:00:00Z'),
    };

    stsMock.on(AssumeRoleCommand).resolves({
      Credentials: mockCredentials,
    });

    secretsMock.on(UpdateSecretCommand).rejects({ name: 'ResourceNotFoundException' });
    secretsMock.on(CreateSecretCommand).resolves({});

    const event = createMockEvent({
      roleArn: 'arn:aws:iam::123456789012:role/TestRole',
      accountAlias: 'Test Account',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('AWS account connected successfully');
    expect(body.connection.accountId).toBe('123456789012');
    expect(body.connection.accountAlias).toBe('Test Account');
    expect(body.connection.status).toBe('connected');
  });

  it('should reject invalid role ARN format', async () => {
    const event = createMockEvent({
      roleArn: 'invalid-arn',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Validation failed');
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].field).toBe('roleArn');
  });

  it('should handle AssumeRole access denied error', async () => {
    stsMock.on(AssumeRoleCommand).rejects({
      name: 'AccessDenied',
      message: 'User is not authorized to perform: sts:AssumeRole',
    });

    const event = createMockEvent({
      roleArn: 'arn:aws:iam::123456789012:role/TestRole',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Access denied');
    expect(body.message).toContain('trust policy');
  });

  it('should update existing secret if it already exists', async () => {
    const mockCredentials = {
      AccessKeyId: 'ASIA...',
      SecretAccessKey: 'secret...',
      SessionToken: 'token...',
      Expiration: new Date('2026-07-25T00:00:00Z'),
    };

    stsMock.on(AssumeRoleCommand).resolves({
      Credentials: mockCredentials,
    });

    secretsMock.on(UpdateSecretCommand).resolves({});

    const event = createMockEvent({
      roleArn: 'arn:aws:iam::123456789012:role/TestRole',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(secretsMock.calls()).toHaveLength(1);
    
    const updateCall = secretsMock.commandCalls(UpdateSecretCommand)[0];
    expect(updateCall.args[0].input.SecretId).toBe('cloudforge/connection/test-user-123');
  });

  it('should handle external ID in AssumeRole request', async () => {
    const mockCredentials = {
      AccessKeyId: 'ASIA...',
      SecretAccessKey: 'secret...',
      SessionToken: 'token...',
      Expiration: new Date('2026-07-25T00:00:00Z'),
    };

    stsMock.on(AssumeRoleCommand).resolves({
      Credentials: mockCredentials,
    });

    secretsMock.on(UpdateSecretCommand).rejects({ name: 'ResourceNotFoundException' });
    secretsMock.on(CreateSecretCommand).resolves({});

    const event = createMockEvent({
      roleArn: 'arn:aws:iam::123456789012:role/TestRole',
      externalId: 'cloudforge-external-id-123',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const assumeRoleCall = stsMock.commandCalls(AssumeRoleCommand)[0];
    expect(assumeRoleCall.args[0].input.ExternalId).toBe('cloudforge-external-id-123');
  });

  it('should require authentication', async () => {
    const event = {
      body: JSON.stringify({ roleArn: 'arn:aws:iam::123456789012:role/TestRole' }),
      requestContext: {
        authorizer: undefined,
      },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Unauthorized');
  });

  it('should validate account alias length', async () => {
    const event = createMockEvent({
      roleArn: 'arn:aws:iam::123456789012:role/TestRole',
      accountAlias: 'a'.repeat(101), // Over 100 characters
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Validation failed');
    expect(body.errors.some((e: any) => e.field === 'accountAlias')).toBe(true);
  });
});
