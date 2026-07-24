import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const stsClient = new STSClient({});
const secretsClient = new SecretsManagerClient({});
const dynamoClient = new DynamoDBClient({});

const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE!;

export interface AssumeRoleInput {
  deploymentId: string;
  userId: string;
  templateBody: string;
  stackName: string;
  region: string;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
  capabilities?: string[];
}

export interface AssumeRoleOutput {
  deploymentId: string;
  userId: string;
  templateBody: string;
  stackName: string;
  region: string;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
  capabilities?: string[];
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
}

/**
 * Step Functions handler: Assume role in user's AWS account
 * Retrieves stored credentials from Secrets Manager
 */
export const handler = async (event: AssumeRoleInput): Promise<AssumeRoleOutput> => {
  console.log('Assuming role for deployment:', event.deploymentId);

  try {
    // Update deployment status
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression: 'SET #status = :status, assumingRoleAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'ASSUMING_ROLE' },
          ':now': { S: new Date().toISOString() },
        },
      })
    );

    // Get stored AWS connection credentials from Secrets Manager
    const secretName = `cloudforge/connection/${event.userId}`;
    const secretResponse = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );

    if (!secretResponse.SecretString) {
      throw new Error('AWS connection not found. Please connect your AWS account first.');
    }

    const connection = JSON.parse(secretResponse.SecretString);

    // Check if credentials are expired
    const expiresAt = new Date(connection.expiresAt);
    if (expiresAt < new Date()) {
      throw new Error('AWS credentials have expired. Please refresh your connection.');
    }

    // Re-assume role to get fresh credentials for this deployment
    const assumeRoleCommand = new AssumeRoleCommand({
      RoleArn: connection.roleArn,
      RoleSessionName: `cloudforge-deployment-${event.deploymentId}`,
      ExternalId: connection.externalId,
      DurationSeconds: 3600, // 1 hour
    });

    const assumeRoleResponse = await stsClient.send(assumeRoleCommand);

    if (!assumeRoleResponse.Credentials) {
      throw new Error('Failed to assume role: No credentials returned');
    }

    console.log('Role assumed successfully:', {
      deploymentId: event.deploymentId,
      accountId: connection.accountId,
    });

    // Update deployment status
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression: 'SET #status = :status, roleAssumedAt = :now, accountId = :accountId',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'ROLE_ASSUMED' },
          ':now': { S: new Date().toISOString() },
          ':accountId': { S: connection.accountId },
        },
      })
    );

    return {
      deploymentId: event.deploymentId,
      userId: event.userId,
      templateBody: event.templateBody,
      stackName: event.stackName,
      region: event.region,
      parameters: event.parameters,
      capabilities: event.capabilities,
      credentials: {
        accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
        secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
        sessionToken: assumeRoleResponse.Credentials.SessionToken!,
      },
    };
  } catch (error: any) {
    console.error('Failed to assume role:', error);

    const errorMessage = error.message || 'Unknown error assuming role';

    // Update deployment status to failed
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: DEPLOYMENTS_TABLE,
        Key: {
          deploymentId: { S: event.deploymentId },
        },
        UpdateExpression:
          'SET #status = :status, failedAt = :now, errorMessage = :error',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: 'ASSUME_ROLE_FAILED' },
          ':now': { S: new Date().toISOString() },
          ':error': { S: errorMessage },
        },
      })
    );

    throw error;
  }
};
