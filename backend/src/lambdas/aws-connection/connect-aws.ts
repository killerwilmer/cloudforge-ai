import {
    CreateSecretCommand,
    SecretsManagerClient,
    UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { AssumeRoleCommand, AssumeRoleCommandOutput, STSClient } from '@aws-sdk/client-sts';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse, validationErrorResponse } from '../../shared/utils';

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
}

/**
 * Connect to AWS account using AssumeRole
 * POST /api/aws-connection/connect
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get user ID from authorizer context
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return errorResponse(401, 'Unauthorized');
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Validate request
    const errors: Array<{ field: string; message: string }> = [];

    if (!body.roleArn || typeof body.roleArn !== 'string') {
      errors.push({ field: 'roleArn', message: 'Role ARN is required' });
    } else if (!/^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/.test(body.roleArn)) {
      errors.push({ field: 'roleArn', message: 'Invalid IAM Role ARN format' });
    }

    if (body.accountAlias && typeof body.accountAlias !== 'string') {
      errors.push({ field: 'accountAlias', message: 'Account alias must be a string' });
    } else if (body.accountAlias && body.accountAlias.length > 100) {
      errors.push({ field: 'accountAlias', message: 'Account alias must be 100 characters or less' });
    }

    if (errors.length > 0) {
      return validationErrorResponse(errors);
    }

    const { roleArn, externalId, accountAlias } = body;

    // Extract account ID from role ARN
    const accountId = roleArn.split(':')[4];
    if (!accountId) {
      return errorResponse(400, 'Invalid role ARN: could not extract account ID');
    }

    // Assume role with optional external ID
    const assumeRoleParams: any = {
      RoleArn: roleArn,
      RoleSessionName: `cloudforge-${userId}-${Date.now()}`,
      DurationSeconds: 3600, // 1 hour (will refresh before expiration)
    };

    if (externalId) {
      assumeRoleParams.ExternalId = externalId;
    }

    console.log('Attempting to assume role:', { roleArn, accountId, hasExternalId: !!externalId });

    let assumeRoleResponse: AssumeRoleCommandOutput;
    try {
      assumeRoleResponse = await stsClient.send(new AssumeRoleCommand(assumeRoleParams));
    } catch (error: any) {
      console.error('AssumeRole failed:', error);

      // Provide helpful error messages
      if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
        return errorResponse(
          403,
          'Access denied. Please verify:\n' +
            '1. The IAM role exists and the ARN is correct\n' +
            '2. The role trust policy allows CloudForge to assume it\n' +
            '3. The External ID matches (if configured)\n' +
            '4. The role has the necessary permissions'
        );
      }

      if (error.name === 'InvalidIdentityToken') {
        return errorResponse(403, 'Invalid External ID. Please check your External ID configuration.');
      }

      return errorResponse(500, `Failed to assume role: ${error.message}`);
    }

    const credentials = assumeRoleResponse.Credentials;
    if (!credentials || !credentials.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
      return errorResponse(500, 'Failed to retrieve credentials from assumed role');
    }

    // Store credentials in Secrets Manager
    const connectionData: ConnectionCredentials = {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
      expiration: credentials.Expiration?.toISOString() || '',
      roleArn,
      accountId,
      accountAlias,
    };

    const secretName = `cloudforge/connection/${userId}`;
    const secretValue = JSON.stringify(connectionData);

    try {
      // Try to update existing secret
      await secretsClient.send(
        new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretValue,
        })
      );
      console.log('Updated existing AWS connection secret');
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Secret doesn't exist, create it
        await secretsClient.send(
          new CreateSecretCommand({
            Name: secretName,
            SecretString: secretValue,
            Description: `AWS connection credentials for CloudForge user ${userId}`,
            Tags: [
              { Key: 'User', Value: userId },
              { Key: 'Service', Value: 'CloudForge' },
              { Key: 'Type', Value: 'AWSConnection' },
            ],
          })
        );
        console.log('Created new AWS connection secret');
      } else {
        throw error;
      }
    }

    // Return success response with connection details (no credentials)
    return successResponse({
      message: 'AWS account connected successfully',
      connection: {
        accountId,
        accountAlias: accountAlias || accountId,
        roleArn,
        expiresAt: credentials.Expiration?.toISOString(),
        status: 'connected',
      },
    });
  } catch (error: any) {
    console.error('Connect AWS error:', error);
    return errorResponse(500, error.message || 'Internal server error');
  }
};
