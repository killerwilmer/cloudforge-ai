import {
    CognitoIdentityProviderClient,
    GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
    errorResponse,
    logger,
    successResponse,
    validationErrorResponse,
} from '../../shared/utils'

// Initialize Cognito client outside handler for reuse
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
})

interface SignOutRequest {
  accessToken: string
}

/**
 * Sign out handler
 * Globally signs out user from all devices by invalidating tokens
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Sign out request received')

    // Get access token from Authorization header or body
    let accessToken: string | undefined

    if (event.headers.Authorization || event.headers.authorization) {
      const authHeader =
        event.headers.Authorization || event.headers.authorization
      accessToken = authHeader?.replace('Bearer ', '')
    } else if (event.body) {
      const body = JSON.parse(event.body) as SignOutRequest
      accessToken = body.accessToken
    }

    if (!accessToken) {
      return validationErrorResponse([
        {
          field: 'accessToken',
          message:
            'Access token is required (via Authorization header or request body)',
        },
      ])
    }

    // Sign out user globally (invalidates all tokens)
    logger.info('Signing out user globally')

    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    })

    await cognitoClient.send(command)

    logger.info('User signed out successfully')

    return successResponse({
      message: 'User signed out successfully',
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Sign out failed', {
      error: err.message,
      errorName: err.name,
    })

    // Handle specific Cognito errors
    if (err.name === 'NotAuthorizedException') {
      return errorResponse(401, 'Invalid or expired access token')
    }

    return errorResponse(500, 'Internal server error')
  }
}
