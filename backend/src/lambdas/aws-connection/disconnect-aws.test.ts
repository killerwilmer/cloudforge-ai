import { DeleteSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from './disconnect-aws';

const secretsMock = mockClient(SecretsManagerClient);

describe('disconnect-aws Lambda', () => {
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

  it('should successfully disconnect AWS account', async () => {
    secretsMock.on(DeleteSecretCommand).resolves({});

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('AWS account disconnected successfully');
  });

  it('should force delete secret immediately', async () => {
    secretsMock.on(DeleteSecretCommand).resolves({});

    const event = createMockEvent();
    await handler(event);

    const deleteCall = secretsMock.commandCalls(DeleteSecretCommand)[0];
    expect(deleteCall.args[0].input.SecretId).toBe('cloudforge/connection/test-user-123');
    expect(deleteCall.args[0].input.ForceDeleteWithoutRecovery).toBe(true);
  });

  it('should return success when no connection exists', async () => {
    secretsMock.on(DeleteSecretCommand).rejects({
      name: 'ResourceNotFoundException',
      message: 'Secret not found',
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('No AWS account was connected');
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
    secretsMock.on(DeleteSecretCommand).rejects({
      name: 'InternalServiceError',
      message: 'Internal error',
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Internal');
  });

  it('should use correct secret name pattern', async () => {
    secretsMock.on(DeleteSecretCommand).resolves({});

    const event = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'different-user-456',
          },
        },
      },
    } as any;

    await handler(event);

    const deleteCall = secretsMock.commandCalls(DeleteSecretCommand)[0];
    expect(deleteCall.args[0].input.SecretId).toBe('cloudforge/connection/different-user-456');
  });
});
