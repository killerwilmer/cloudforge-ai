import {
    GetSecretValueCommand,
    SecretsManagerClient,
    UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from './refresh-connection';

const stsMock = mockClient(STSClient);
const secretsMock = mockClient(SecretsManagerClient);

describe('refresh-connection Lambda', () => {
  beforeEach(() => {
    stsMock.reset();
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

  it('should successfully refresh connection credentials', async () => {
    const oldExpiration = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
    const newExpiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Mock existing credentials
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'OLD_KEY',
        secretAccessKey: 'OLD_SECRET',
        sessionToken: 'OLD_TOKEN',
        expiration: oldExpiration,
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
        accountAlias: 'Test Account',
      }),
    });

    // Mock new credentials from AssumeRole
    stsMock.on(AssumeRoleCommand).resolves({
      Credentials: {
        AccessKeyId: 'NEW_KEY',
        SecretAccessKey: 'NEW_SECRET',
        SessionToken: 'NEW_TOKEN',
        Expiration: newExpiration,
      },
    });

    secretsMock.on(UpdateSecretCommand).resolves({});

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('AWS connection refreshed successfully');
    expect(body.connection.status).toBe('connected');
    expect(body.connection.expiresAt).toBe(newExpiration.toISOString());
  });

  it('should return 404 when no connection exists', async () => {
    secretsMock.on(GetSecretValueCommand).rejects({
      name: 'ResourceNotFoundException',
      message: 'Secret not found',
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('No AWS connection found');
  });

  it('should handle AssumeRole failure during refresh', async () => {
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'OLD_KEY',
        secretAccessKey: 'OLD_SECRET',
        sessionToken: 'OLD_TOKEN',
        expiration: new Date().toISOString(),
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
      }),
    });

    stsMock.on(AssumeRoleCommand).rejects({
      name: 'AccessDenied',
      message: 'Access denied',
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Failed to refresh connection');
    expect(body.message).toContain('Access denied');
  });

  it('should preserve external ID when refreshing', async () => {
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'OLD_KEY',
        secretAccessKey: 'OLD_SECRET',
        sessionToken: 'OLD_TOKEN',
        expiration: new Date().toISOString(),
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
        externalId: 'my-external-id-123',
      }),
    });

    stsMock.on(AssumeRoleCommand).resolves({
      Credentials: {
        AccessKeyId: 'NEW_KEY',
        SecretAccessKey: 'NEW_SECRET',
        SessionToken: 'NEW_TOKEN',
        Expiration: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    secretsMock.on(UpdateSecretCommand).resolves({});

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    
    const assumeRoleCall = stsMock.commandCalls(AssumeRoleCommand)[0];
    expect(assumeRoleCall.args[0].input.ExternalId).toBe('my-external-id-123');
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

  it('should update secret with new credentials', async () => {
    const newExpiration = new Date(Date.now() + 60 * 60 * 1000);

    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({
        accessKeyId: 'OLD_KEY',
        secretAccessKey: 'OLD_SECRET',
        sessionToken: 'OLD_TOKEN',
        expiration: new Date().toISOString(),
        roleArn: 'arn:aws:iam::123456789012:role/TestRole',
        accountId: '123456789012',
        accountAlias: 'Test Account',
      }),
    });

    stsMock.on(AssumeRoleCommand).resolves({
      Credentials: {
        AccessKeyId: 'NEW_KEY',
        SecretAccessKey: 'NEW_SECRET',
        SessionToken: 'NEW_TOKEN',
        Expiration: newExpiration,
      },
    });

    secretsMock.on(UpdateSecretCommand).resolves({});

    const event = createMockEvent();
    await handler(event);

    const updateCall = secretsMock.commandCalls(UpdateSecretCommand)[0];
    expect(updateCall.args[0].input.SecretId).toBe('cloudforge/connection/test-user-123');
    
    const updatedSecret = JSON.parse(updateCall.args[0].input.SecretString as string);
    expect(updatedSecret.accessKeyId).toBe('NEW_KEY');
    expect(updatedSecret.secretAccessKey).toBe('NEW_SECRET');
    expect(updatedSecret.sessionToken).toBe('NEW_TOKEN');
    expect(updatedSecret.expiration).toBe(newExpiration.toISOString());
  });
});
