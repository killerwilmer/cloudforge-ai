import {
    AuthFlowType,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
    errorResponse,
    loadAuthConfig,
    logger,
    successResponse,
    validationErrorResponse,
} from '../../shared/utils'

// Initialize Cognito client outside handler for reuse
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
})

// Load and validate configuration
const config = loadAuthConfig()

interface RefreshTokenRequest {
  refreshToken: string
}

/**
 * Refresh token handler
 * Uses refresh token to get new access and ID tokens
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Refresh token request received')

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as RefreshTokenRequest

    if (!body.refreshToken) {
      return validationErrorResponse([
        { field: 'refreshToken', message: 'Refresh token is required' },
      ])
    }

    // Refresh tokens with Cognito
    logger.info('Refreshing tokens with Cognito')

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: config.cognito.clientId,
      AuthParameters: {
        REFRESH_TOKEN: body.refreshToken,
      },
    })

    const response = await cognitoClient.send(command)

    if (!response.AuthenticationResult) {
      logger.warn('Token refresh failed - no tokens returned')
      return errorResponse(401, 'Token refresh failed')
    }

    const { AccessToken, IdToken, ExpiresIn } = response.AuthenticationResult

    logger.info('Tokens refreshed successfully')

    return successResponse({
      accessToken: AccessToken,
      idToken: IdToken,
      expiresIn: ExpiresIn,
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Token refresh failed', {
      error: err.message,
      errorName: err.name,
    })

    // Handle specific Cognito errors
    if (err.name === 'NotAuthorizedException') {
      return errorResponse(401, 'Invalid or expired refresh token')
    }

    return errorResponse(500, 'Internal server error')
  }
}
