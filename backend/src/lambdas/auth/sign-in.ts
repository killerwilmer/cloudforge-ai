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

interface SignInRequest {
  email: string
  password: string
}

/**
 * Sign in handler
 * Authenticates user with Cognito using email and password
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Sign in request received')

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as SignInRequest

    const errors: Array<{ field: string; message: string }> = []

    if (!body.email) {
      errors.push({ field: 'email', message: 'Email is required' })
    } else {
      // Validate email format only if email is provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        errors.push({ field: 'email', message: 'Invalid email format' })
      }
    }

    if (!body.password) {
      errors.push({ field: 'password', message: 'Password is required' })
    }

    if (errors.length > 0) {
      return validationErrorResponse(errors)
    }

    // Authenticate with Cognito
    logger.info('Authenticating user with Cognito')

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: config.cognito.clientId,
      AuthParameters: {
        USERNAME: body.email,
        PASSWORD: body.password,
      },
    })

    const response = await cognitoClient.send(command)

    if (!response.AuthenticationResult) {
      logger.warn('Authentication failed - no tokens returned')
      return errorResponse(401, 'Authentication failed')
    }

    const { AccessToken, IdToken, RefreshToken, ExpiresIn } =
      response.AuthenticationResult

    logger.info('User authenticated successfully', { email: body.email })

    return successResponse({
      accessToken: AccessToken,
      idToken: IdToken,
      refreshToken: RefreshToken,
      expiresIn: ExpiresIn,
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Sign in failed', {
      error: err.message,
      errorName: err.name,
    })

    // Handle specific Cognito errors
    if (err.name === 'NotAuthorizedException') {
      return errorResponse(401, 'Invalid email or password')
    }

    if (err.name === 'UserNotFoundException') {
      return errorResponse(401, 'Invalid email or password')
    }

    if (err.name === 'UserNotConfirmedException') {
      return errorResponse(403, 'Please verify your email before signing in')
    }

    return errorResponse(500, 'Internal server error')
  }
}
