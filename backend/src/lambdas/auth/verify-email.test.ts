import {
    CognitoIdentityProviderClient,
    ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import { handler } from './verify-email'

const cognitoMock = mockClient(CognitoIdentityProviderClient)

describe('Verify Email Lambda', () => {
  beforeEach(() => {
    cognitoMock.reset()
    process.env.USER_POOL_CLIENT_ID = 'test-client-id'
  })

  const createEvent = (body: unknown): APIGatewayProxyEvent =>
    ({
      body: JSON.stringify(body),
      requestContext: {
        requestId: 'test-request-id',
      },
    }) as APIGatewayProxyEvent

  describe('successful verification', () => {
    it('should verify email with valid code', async () => {
      cognitoMock.on(ConfirmSignUpCommand).resolves({})

      const event = createEvent({
        email: 'test@example.com',
        code: '123456',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('verified successfully')
    })

    it('should call ConfirmSignUpCommand with correct parameters', async () => {
      cognitoMock.on(ConfirmSignUpCommand).resolves({})

      const event = createEvent({
        email: 'test@example.com',
        code: '654321',
      })

      await handler(event)

      const calls = cognitoMock.commandCalls(ConfirmSignUpCommand)
      expect(calls.length).toBe(1)
      expect(calls[0].args[0].input).toMatchObject({
        ClientId: 'test-client-id',
        Username: 'test@example.com',
        ConfirmationCode: '654321',
      })
    })
  })

  describe('validation', () => {
    it('should return 400 for missing email', async () => {
      const event = createEvent({
        code: '123456',
      })

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
        code: '123456',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const emailError = body.errors.find((e: { field: string }) => e.field === 'email')
      expect(emailError.message).toContain('Invalid email format')
    })

    it('should return 400 for missing code', async () => {
      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const codeError = body.errors.find((e: { field: string }) => e.field === 'code')
      expect(codeError).toBeDefined()
      expect(codeError.message).toContain('required')
    })

    it('should return 400 for invalid code format (not 6 digits)', async () => {
      const event = createEvent({
        email: 'test@example.com',
        code: '12345', // Only 5 digits
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const codeError = body.errors.find((e: { field: string }) => e.field === 'code')
      expect(codeError.message).toContain('6 digits')
    })

    it('should return 400 for code with non-numeric characters', async () => {
      const event = createEvent({
        email: 'test@example.com',
        code: '12345a',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const codeError = body.errors.find((e: { field: string }) => e.field === 'code')
      expect(codeError.message).toContain('6 digits')
    })
  })

  describe('error handling', () => {
    it('should return 400 for invalid verification code', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'CodeMismatchException',
        message: 'Invalid verification code provided',
      })

      const event = createEvent({
        email: 'test@example.com',
        code: '999999',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invalid verification code')
    })

    it('should return 400 for expired verification code', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'ExpiredCodeException',
        message: 'Invalid code provided, please request a code again',
      })

      const event = createEvent({
        email: 'test@example.com',
        code: '123456',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('expired')
      expect(body.message).toContain('request a new code')
    })

    it('should return 400 for already confirmed user', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'User cannot be confirmed. Current status is CONFIRMED',
      })

      const event = createEvent({
        email: 'test@example.com',
        code: '123456',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('already confirmed')
    })

    it('should return 404 for user not found', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'UserNotFoundException',
        message: 'User does not exist',
      })

      const event = createEvent({
        email: 'nonexistent@example.com',
        code: '123456',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(404)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('not found')
    })

    it('should return 429 for too many failed attempts', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'TooManyFailedAttemptsException',
        message: 'Attempt limit exceeded',
      })

      const event = createEvent({
        email: 'test@example.com',
        code: '123456',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(429)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Too many')
      expect(body.message).toContain('request a new code')
    })

    it('should return 500 for unexpected errors', async () => {
      cognitoMock.on(ConfirmSignUpCommand).rejects({
        name: 'ServiceUnavailableException',
        message: 'Service is unavailable',
      })

      const event = createEvent({
        email: 'test@example.com',
        code: '123456',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Internal server error')
    })
  })
})
