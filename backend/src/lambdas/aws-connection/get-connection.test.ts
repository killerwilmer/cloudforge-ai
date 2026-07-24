import { handler } from './get-connection';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';

const secretsMock = mockClient(SecretsManagerClient);

describe('get-connection Lambda', () => {
  beforeEach(() => {
    secretsMock.reset();
  });

  const createMockEvent = (): APIGatewayProxyEvent => {
    return {
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

  it('should return connection status when connected', async () => {
    const futureExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'ASIA...',
        secretAccessKey: 'secret...',
        sessionToken: 'token...',
        expiration: futureExpiration,
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
        accountAlias: 'Test Account',
      }),
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.connection).toBeDefined();
    expect(body.connection.accountId).toBe('123456789012');
    expect(body.connection.accountAlias).toBe('Test Account');
    expect(body.connection.status).toBe('connected');
  });

  it('should return expiring status when credentials expire soon', async () => {
    const soonExpiration = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3 minutes from now

    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'ASIA...',
        secretAccessKey: 'secret...',
        sessionToken: 'token...',
        expiration: soonExpiration,
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
      }),
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.connection.status).toBe('expiring');
  });

  it('should return expired status when credentials are expired', async () => {
    const pastExpiration = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago

    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'ASIA...',
        secretAccessKey: 'secret...',
        sessionToken: 'token...',
        expiration: pastExpiration,
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
      }),
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.connection.status).toBe('expired');
  });

  it('should return null connection when no secret exists', async () => {
    secretsMock.on(GetSecretValueCommand).rejects({
      name: 'ResourceNotFoundException',
      message: 'Secret not found',
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.connection).toBeNull();
    expect(body.message).toBe('No AWS account connected');
  });

  it('should not expose credentials in response', async () => {
    const futureExpiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'ASIA...',
        secretAccessKey: 'secret...',
        sessionToken: 'token...',
        expiration: futureExpiration,
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
      }),
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.connection.accessKeyId).toBeUndefined();
    expect(body.connection.secretAccessKey).toBeUndefined();
    expect(body.connection.sessionToken).toBeUndefined();
  });

  it('should require authentication', async () => {
    const event = {
      requestContext: {
        authorizer: undefined,
      },
    } as any;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Unauthorized');
  });

  it('should handle Secrets Manager errors', async () => {
    secretsMock.on(GetSecretValueCommand).rejects({
      name: 'InternalServiceError',
      message: 'Internal error',
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Internal');
  });
});
