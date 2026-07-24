import {
    CognitoIdentityProviderClient,
    ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
    errorResponse,
    loadAuthConfig,
    logger,
    successResponse,
    validationErrorResponse,
} from '../../shared/utils'

// Initialize clients outside handler for reuse
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
})

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION,
}))

// Load and validate configuration
const config = loadAuthConfig()

interface ResendCodeRequest {
  email: string
}

interface RateLimitRecord {
  email: string
  lastRequestTime: number
  requestCount: number
  ttl: number
}

// Rate limiting: max 3 requests per hour per email
const MAX_REQUESTS_PER_HOUR = 3
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Check rate limit for resend code requests
 * Returns true if rate limit exceeded
 */
async function isRateLimitExceeded(email: string): Promise<boolean> {
  const tableName = process.env.DYNAMODB_USERS_TABLE
  if (!tableName) {
    logger.error('DYNAMODB_USERS_TABLE environment variable not set')
    return false // Fail open if table not configured
  }

  const rateLimitKey = `rate-limit:resend-code:${email}`
  const now = Date.now()

  try {
    // Get existing rate limit record
    const getResult = await dynamoClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { userId: rateLimitKey },
      })
    )

    const record = getResult.Item as RateLimitRecord | undefined

    if (!record) {
      // First request, create new record
      await dynamoClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            userId: rateLimitKey,
            email,
            lastRequestTime: now,
            requestCount: 1,
            ttl: Math.floor((now + RATE_LIMIT_WINDOW_MS) / 1000), // DynamoDB TTL in seconds
          },
        })
      )
      return false
    }

    // Check if window has expired
    const timeSinceFirstRequest = now - record.lastRequestTime
    if (timeSinceFirstRequest > RATE_LIMIT_WINDOW_MS) {
      // Window expired, reset counter
      await dynamoClient.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            userId: rateLimitKey,
            email,
            lastRequestTime: now,
            requestCount: 1,
            ttl: Math.floor((now + RATE_LIMIT_WINDOW_MS) / 1000),
          },
        })
      )
      return false
    }

    // Check if limit exceeded
    if (record.requestCount >= MAX_REQUESTS_PER_HOUR) {
      const remainingTime = Math.ceil(
        (RATE_LIMIT_WINDOW_MS - timeSinceFirstRequest) / 60000
      ) // minutes
      logger.warn('Rate limit exceeded for resend code', {
        email,
        requestCount: record.requestCount,
        remainingTimeMinutes: remainingTime,
      })
      return true
    }

    // Increment counter
    await dynamoClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          userId: rateLimitKey,
          email,
          lastRequestTime: record.lastRequestTime,
          requestCount: record.requestCount + 1,
          ttl: record.ttl,
        },
      })
    )

    return false
  } catch (error) {
    logger.error('Failed to check rate limit', { error })
    return false // Fail open on error
  }
}

/**
 * Resend confirmation code handler
 * Resends verification code to user's email
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Resend verification code request received')

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as ResendCodeRequest

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

    if (errors.length > 0) {
      return validationErrorResponse(errors)
    }

    // Check rate limit
    logger.info('Checking rate limit', { email: body.email })
    const rateLimitExceeded = await isRateLimitExceeded(body.email)

    if (rateLimitExceeded) {
      return errorResponse(
        429,
        'Too many requests. Please wait before requesting another code.'
      )
    }

    // Resend confirmation code with Cognito
    logger.info('Resending confirmation code', { email: body.email })

    const command = new ResendConfirmationCodeCommand({
      ClientId: config.cognito.clientId,
      Username: body.email,
    })

    await cognitoClient.send(command)

    logger.info('Confirmation code resent successfully', { email: body.email })

    return successResponse({
      message: 'Verification code sent. Please check your email.',
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Resend confirmation code failed', {
      error: err.message,
      errorName: err.name,
    })

    // Handle specific Cognito errors
    if (err.name === 'UserNotFoundException') {
      return errorResponse(404, 'User not found')
    }

    if (err.name === 'InvalidParameterException') {
      return errorResponse(400, 'User is already confirmed')
    }

    if (err.name === 'LimitExceededException') {
      return errorResponse(
        429,
        'Attempt limit exceeded. Please try again later.'
      )
    }

    if (err.name === 'TooManyRequestsException') {
      return errorResponse(
        429,
        'Too many requests. Please try again later.'
      )
    }

    return errorResponse(500, 'Internal server error')
  }
}
