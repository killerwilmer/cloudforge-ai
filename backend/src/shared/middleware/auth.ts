import {
    CognitoIdentityProviderClient,
    GetUserCommand,
    GetUserCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { errorResponse, logger } from '../utils'

// Initialize Cognito client outside handler for reuse
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
})

/**
 * User object returned from token validation
 */
export interface AuthenticatedUser {
  username: string
  sub: string
  email: string
  name: string
  attributes: Record<string, string>
}

/**
 * Extract access token from Authorization header
 */
function extractAccessToken(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers.Authorization || event.headers.authorization

  if (!authHeader) {
    return null
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  return parts[1]
}

/**
 * Middleware to validate JWT token with Cognito
 * Returns user info if valid, error response if invalid
 */
export async function validateToken(
  event: APIGatewayProxyEvent
): Promise<
  | { valid: false; response: APIGatewayProxyResult }
  | { valid: true; user: AuthenticatedUser }
> {
  try {
    // Extract access token
    const accessToken = extractAccessToken(event)

    if (!accessToken) {
      return {
        valid: false,
        response: errorResponse(401, 'Missing or invalid Authorization header'),
      }
    }

    // Validate token with Cognito
    logger.info('Validating access token with Cognito')

    const command = new GetUserCommand({
      AccessToken: accessToken,
    })

    const response: GetUserCommandOutput = await cognitoClient.send(command)

    // Extract user attributes
    const userAttributes: Record<string, string> = {}
    response.UserAttributes?.forEach((attr) => {
      if (attr.Name && attr.Value) {
        userAttributes[attr.Name] = attr.Value
      }
    })

    const user: AuthenticatedUser = {
      username: response.Username || '',
      sub: userAttributes.sub || '',
      email: userAttributes.email || '',
      name: userAttributes.name || '',
      attributes: userAttributes,
    }

    logger.info('Token validated successfully', { username: user.username })

    return {
      valid: true,
      user,
    }
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Token validation failed', {
      error: err.message,
      errorName: err.name,
    })

    if (err.name === 'NotAuthorizedException') {
      return {
        valid: false,
        response: errorResponse(401, 'Invalid or expired access token'),
      }
    }

    return {
      valid: false,
      response: errorResponse(500, 'Internal server error'),
    }
  }
}

/**
 * Higher-order function to wrap Lambda handlers with authentication
 * Usage: export const handler = withAuth(async (event, user) => { ... })
 */
export function withAuth(
  handler: (
    event: APIGatewayProxyEvent,
    user: AuthenticatedUser
  ) => Promise<APIGatewayProxyResult>
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const validation = await validateToken(event)

    if (!validation.valid) {
      return validation.response
    }

    // Call the actual handler with validated user
    return handler(event, validation.user)
  }
}
