import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../shared/utils';

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
 * Get AWS connection status
 * GET /api/aws-connection/status
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Get user ID from authorizer context
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return errorResponse(401, 'Unauthorized');
    }

    const secretName = `cloudforge/connection/${userId}`;

    try {
      // Get credentials from Secrets Manager
      const secretResponse = await secretsClient.send(
        new GetSecretValueCommand({
          SecretId: secretName,
        })
      );

      if (!secretResponse.SecretString) {
        return errorResponse(404, 'No AWS connection found');
      }

      const credentials: ConnectionCredentials = JSON.parse(secretResponse.SecretString);

      // Check if credentials are expired or expiring soon (within 5 minutes)
      const expirationDate = new Date(credentials.expiration);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      let status: 'connected' | 'expiring' | 'expired';
      if (expirationDate < now) {
        status = 'expired';
      } else if (expirationDate < fiveMinutesFromNow) {
        status = 'expiring';
      } else {
        status = 'connected';
      }

      // Return connection details without exposing credentials
      return successResponse({
        connection: {
          accountId: credentials.accountId,
          accountAlias: credentials.accountAlias || credentials.accountId,
          roleArn: credentials.roleArn,
          expiresAt: credentials.expiration,
          status,
        },
      });
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return successResponse({
          connection: null,
          message: 'No AWS account connected',
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Get connection error:', error);
    return errorResponse(500, error.message || 'Internal server error');
  }
};
