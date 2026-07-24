import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import {
  logger,
  successResponse,
  errorResponse,
  validationErrorResponse,
  loadAuthConfig,
} from '../../shared/utils'

// Initialize Cognito client outside handler for reuse
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
})

// Load and validate configuration
const config = loadAuthConfig()

interface SignUpRequest {
  email: string
  password: string
  name: string
}

/**
 * Sign up handler
 * Registers new user with Cognito
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Sign up request received')

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as SignUpRequest

    // Validation
    const errors: Array<{ field: string; message: string }> = []

    if (!body.email) {
      errors.push({ field: 'email', message: 'Email is required' })
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        errors.push({ field: 'email', message: 'Invalid email format' })
      }
    }

    if (!body.password) {
      errors.push({ field: 'password', message: 'Password is required' })
    } else if (body.password.length < 8) {
      errors.push({
        field: 'password',
        message: 'Password must be at least 8 characters',
      })
    }

    if (!body.name) {
      errors.push({ field: 'name', message: 'Name is required' })
    }

    if (errors.length > 0) {
      return validationErrorResponse(errors)
    }

    // Register user with Cognito
    logger.info('Registering user with Cognito')

    const command = new SignUpCommand({
      ClientId: config.cognito.clientId,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        {
          Name: 'email',
          Value: body.email,
        },
        {
          Name: 'name',
          Value: body.name,
        },
      ],
    })

    const response = await cognitoClient.send(command)

    logger.info('User registered successfully', {
      email: body.email,
      userSub: response.UserSub,
    })

    return successResponse({
      message: 'User registered successfully. Please verify your email.',
      userSub: response.UserSub,
      userConfirmed: response.UserConfirmed,
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Sign up failed', {
      error: err.message,
      errorName: err.name,
    })

    // Handle specific Cognito errors
    if (err.name === 'UsernameExistsException') {
      return errorResponse(409, 'An account with this email already exists')
    }

    if (err.name === 'InvalidPasswordException') {
      return errorResponse(
        400,
        'Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, numbers, and special characters.'
      )
    }

    if (err.name === 'InvalidParameterException') {
      return errorResponse(400, 'Invalid parameters provided')
    }

    return errorResponse(500, 'Internal server error')
  }
}
