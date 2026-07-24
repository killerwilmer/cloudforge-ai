import {
    CognitoIdentityProviderClient,
    ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import { handler } from './resend-code'

const cognitoMock = mockClient(CognitoIdentityProviderClient)
const dynamoMock = mockClient(DynamoDBDocumentClient)

describe('Resend Code Lambda', () => {
  beforeEach(() => {
    cognitoMock.reset()
    dynamoMock.reset()
    process.env.USER_POOL_CLIENT_ID = 'test-client-id'
    process.env.DYNAMODB_USERS_TABLE = 'test-users-table'
  })

  const createEvent = (body: unknown): APIGatewayProxyEvent =>
    ({
      body: JSON.stringify(body),
      requestContext: {
        requestId: 'test-request-id',
      },
    }) as APIGatewayProxyEvent

  describe('successful resend', () => {
    it('should resend verification code for first request', async () => {
      // No existing rate limit record
      dynamoMock.on(GetCommand).resolves({ Item: undefined })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).resolves({})

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Verification code sent')

      // Verify rate limit record was created
      const putCalls = dynamoMock.commandCalls(PutCommand)
      expect(putCalls.length).toBe(1)
      expect(putCalls[0].args[0].input.Item).toMatchObject({
        email: 'test@example.com',
        requestCount: 1,
      })
    })

    it('should resend code when under rate limit', async () => {
      const now = Date.now()
      // Existing record with 2 requests (under limit of 3)
      dynamoMock.on(GetCommand).resolves({
        Item: {
          userId: 'rate-limit:resend-code:test@example.com',
          email: 'test@example.com',
          lastRequestTime: now - 1000, // 1 second ago
          requestCount: 2,
          ttl: Math.floor((now + 3600000) / 1000),
        },
      })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).resolves({})

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)

      // Verify request count was incremented
      const putCalls = dynamoMock.commandCalls(PutCommand)
      expect(putCalls.length).toBeGreaterThan(0)
      expect(putCalls[0].args[0].input.Item?.requestCount).toBe(3)
    })

    it('should reset rate limit after window expires', async () => {
      const now = Date.now()
      const oldTime = now - (60 * 60 * 1000 + 1000) // Over 1 hour ago

      // Existing record with expired window
      dynamoMock.on(GetCommand).resolves({
        Item: {
          userId: 'rate-limit:resend-code:test@example.com',
          email: 'test@example.com',
          lastRequestTime: oldTime,
          requestCount: 3, // Was at limit
          ttl: Math.floor((oldTime + 3600000) / 1000),
        },
      })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).resolves({})

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)

      // Verify rate limit was reset
      const putCalls = dynamoMock.commandCalls(PutCommand)
      expect(putCalls.length).toBeGreaterThan(0)
      expect(putCalls[0].args[0].input.Item?.requestCount).toBe(1)
    })
  })

  describe('validation', () => {
    it('should return 400 for missing email', async () => {
      const event = createEvent({})

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors).toBeDefined()
      const emailError = body.errors.find((e: { field: string }) => e.field === 'email')
      expect(emailError).toBeDefined()
      expect(emailError.message).toContain('required')
    })

    it('should return 400 for invalid email format', async () => {
      const event = createEvent({
        email: 'invalid-email',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const emailError = body.errors.find((e: { field: string }) => e.field === 'email')
      expect(emailError.message).toContain('Invalid email format')
    })
  })

  describe('rate limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      const now = Date.now()
      // Existing record at rate limit (3 requests)
      dynamoMock.on(GetCommand).resolves({
        Item: {
          userId: 'rate-limit:resend-code:test@example.com',
          email: 'test@example.com',
          lastRequestTime: now - 1000, // 1 second ago (within window)
          requestCount: 3,
          ttl: Math.floor((now + 3600000) / 1000),
        },
      })

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(429)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Too many requests')

      // Verify Cognito was not called
      const cognitoCalls = cognitoMock.commandCalls(ResendConfirmationCodeCommand)
      expect(cognitoCalls.length).toBe(0)
    })

    it('should handle DynamoDB errors gracefully and allow request', async () => {
      // DynamoDB fails but we should fail open
      dynamoMock.on(GetCommand).rejects(new Error('DynamoDB error'))
      cognitoMock.on(ResendConfirmationCodeCommand).resolves({})

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      // Should succeed despite DynamoDB error
      expect(response.statusCode).toBe(200)
    })
  })

  describe('error handling', () => {
    it('should return 404 for user not found', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).rejects({
        name: 'UserNotFoundException',
        message: 'User does not exist',
      })

      const event = createEvent({
        email: 'nonexistent@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('not found')
    })

    it('should return 400 for already confirmed user', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).rejects({
        name: 'InvalidParameterException',
        message: 'User is already confirmed',
      })

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('already confirmed')
    })

    it('should return 429 for Cognito limit exceeded', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).rejects({
        name: 'LimitExceededException',
        message: 'Attempt limit exceeded',
      })

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(429)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Attempt limit exceeded')
    })

    it('should return 429 for too many requests', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).rejects({
        name: 'TooManyRequestsException',
        message: 'Rate exceeded',
      })

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(429)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Too many requests')
    })

    it('should return 500 for unexpected errors', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined })
      dynamoMock.on(PutCommand).resolves({})
      cognitoMock.on(ResendConfirmationCodeCommand).rejects({
        name: 'ServiceUnavailableException',
        message: 'Service is unavailable',
      })

      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Internal server error')
    })
  })
})
