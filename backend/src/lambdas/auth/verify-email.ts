import {
    CognitoIdentityProviderClient,
    ConfirmSignUpCommand,
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

interface VerifyEmailRequest {
  email: string
  code: string
}

/**
 * Verify email handler
 * Confirms user signup with Cognito using verification code
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Email verification request received')

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as VerifyEmailRequest

    const errors: Array<{ field: string; message: string }> = []

    if (!body.email) {
      errors.push({ field: 'email', message: 'Email is required' })
    } else {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(body.email)) {
        errors.push({ field: 'email', message: 'Invalid email format' })
      }
    }

    if (!body.code) {
      errors.push({ field: 'code', message: 'Verification code is required' })
    } else {
      // Validate code format (6 digits)
      const codeRegex = /^\d{6}$/
      if (!codeRegex.test(body.code)) {
        errors.push({
          field: 'code',
          message: 'Verification code must be 6 digits',
        })
      }
    }

    if (errors.length > 0) {
      return validationErrorResponse(errors)
    }

    // Confirm signup with Cognito
    logger.info('Confirming user signup with Cognito', { email: body.email })

    const command = new ConfirmSignUpCommand({
      ClientId: config.cognito.clientId,
      Username: body.email,
      ConfirmationCode: body.code,
    })

    await cognitoClient.send(command)

    logger.info('Email verified successfully', { email: body.email })

    return successResponse({
      message: 'Email verified successfully. You can now sign in.',
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Email verification failed', {
      error: err.message,
      errorName: err.name,
    })

    // Handle specific Cognito errors
    if (err.name === 'CodeMismatchException') {
      return errorResponse(400, 'Invalid verification code')
    }

    if (err.name === 'ExpiredCodeException') {
      return errorResponse(
        400,
        'Verification code has expired. Please request a new code.'
      )
    }

    if (err.name === 'NotAuthorizedException') {
      return errorResponse(400, 'User is already confirmed')
    }

    if (err.name === 'UserNotFoundException') {
      return errorResponse(404, 'User not found')
    }

    if (err.name === 'TooManyFailedAttemptsException') {
      return errorResponse(
        429,
        'Too many failed verification attempts. Please request a new code.'
      )
    }

    return errorResponse(500, 'Internal server error')
  }
}
