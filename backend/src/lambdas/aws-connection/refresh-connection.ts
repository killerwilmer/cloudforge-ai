import { GetSecretValueCommand, SecretsManagerClient, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { AssumeRoleCommand, AssumeRoleCommandOutput, STSClient } from '@aws-sdk/client-sts';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../shared/utils';

const stsClient = new STSClient({ region: process.env.AWS_REGION });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

interface ConnectionCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  roleArn: string;
  accountId: string;
  accountAlias?: string;
  externalId?: string;
}

/**
 * Refresh AWS connection credentials
 * POST /api/aws-connection/refresh
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get user ID from authorizer context
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return errorResponse(401, 'Unauthorized');
    }

    const secretName = `cloudforge/connection/${userId}`;

    // Get existing credentials
    let existingCredentials: ConnectionCredentials;
    try {
      const secretResponse = await secretsClient.send(
        new GetSecretValueCommand({
          SecretId: secretName,
        })
      );

      if (!secretResponse.SecretString) {
        return errorResponse(404, 'No AWS connection found. Please connect an AWS account first.');
      }

      existingCredentials = JSON.parse(secretResponse.SecretString);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return errorResponse(404, 'No AWS connection found. Please connect an AWS account first.');
      }
      throw error;
    }

    // Assume role again to get fresh credentials
    const assumeRoleParams: any = {
      RoleArn: existingCredentials.roleArn,
      RoleSessionName: `cloudforge-${userId}-${Date.now()}`,
      DurationSeconds: 3600, // 1 hour
    };

    if (existingCredentials.externalId) {
      assumeRoleParams.ExternalId = existingCredentials.externalId;
    }

    console.log('Refreshing credentials for role:', existingCredentials.roleArn);

    let assumeRoleResponse: AssumeRoleCommandOutput;
    try {
      assumeRoleResponse = await stsClient.send(new AssumeRoleCommand(assumeRoleParams));
    } catch (error: any) {
      console.error('AssumeRole failed during refresh:', error);

      if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
        return errorResponse(
          403,
          'Failed to refresh connection: Access denied. The IAM role may have been deleted or its trust policy changed.'
        );
      }

      return errorResponse(500, `Failed to refresh connection: ${error.message}`);
    }

    const credentials = assumeRoleResponse.Credentials;
    if (!credentials || !credentials.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
      return errorResponse(500, 'Failed to retrieve credentials from assumed role');
    }

    // Update credentials in Secrets Manager
    const updatedCredentials: ConnectionCredentials = {
      ...existingCredentials,
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
      expiration: credentials.Expiration?.toISOString() || '',
    };

    await secretsClient.send(
      new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: JSON.stringify(updatedCredentials),
      })
    );

    console.log('Successfully refreshed AWS connection credentials');

    // Return success response with updated connection details
    return successResponse({
      message: 'AWS connection refreshed successfully',
      connection: {
        accountId: existingCredentials.accountId,
        accountAlias: existingCredentials.accountAlias || existingCredentials.accountId,
        roleArn: existingCredentials.roleArn,
        expiresAt: credentials.Expiration?.toISOString(),
        status: 'connected',
      },
    });
  } catch (error: any) {
    console.error('Refresh connection error:', error);
    return errorResponse(500, error.message || 'Internal server error');
  }
};
