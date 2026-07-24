import { DeleteSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../shared/utils';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

/**
 * Disconnect AWS account
 * DELETE /api/aws-connection/disconnect
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
      // Delete secret from Secrets Manager
      await secretsClient.send(
        new DeleteSecretCommand({
          SecretId: secretName,
          ForceDeleteWithoutRecovery: true, // Immediate deletion
        })
      );

      console.log('Successfully disconnected AWS account for user:', userId);

      return successResponse({
        message: 'AWS account disconnected successfully',
      });
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        return successResponse({
          message: 'No AWS account was connected',
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Disconnect AWS error:', error);
    return errorResponse(500, error.message || 'Internal server error');
  }
};
