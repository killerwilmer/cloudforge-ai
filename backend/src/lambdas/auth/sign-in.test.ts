import { APIGatewayProxyEvent } from 'aws-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { handler } from './sign-in'

const cognitoMock = mockClient(CognitoIdentityProviderClient)

describe('Sign In Lambda', () => {
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

  describe('successful login', () => {
    it('should return tokens for valid credentials', async () => {
      const mockTokens = {
        AccessToken: 'mock-access-token',
        IdToken: 'mock-id-token',
        RefreshToken: 'mock-refresh-token',
        ExpiresIn: 3600,
      }

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: mockTokens,
      })

      const event = createEvent({
        email: 'test@example.com',
        password: 'ValidPassword123!',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.accessToken).toBe(mockTokens.AccessToken)
      expect(body.idToken).toBe(mockTokens.IdToken)
      expect(body.refreshToken).toBe(mockTokens.RefreshToken)
      expect(body.expiresIn).toBe(mockTokens.ExpiresIn)
    })
  })

  describe('failed login', () => {
    it('should return 401 for invalid credentials', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Incorrect username or password',
      })

      const event = createEvent({
        email: 'test@example.com',
        password: 'WrongPassword',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Invalid email or password')
    })

    it('should return 401 for non-existent user', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'UserNotFoundException',
        message: 'User does not exist',
      })

      const event = createEvent({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Invalid email or password')
    })

    it('should return 403 for unconfirmed user', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'UserNotConfirmedException',
        message: 'User is not confirmed',
      })

      const event = createEvent({
        email: 'unconfirmed@example.com',
        password: 'Password123!',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Please verify your email before signing in')
    })
  })

  describe('validation', () => {
    it('should return 400 for missing email', async () => {
      const event = createEvent({
        password: 'Password123!',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].field).toBe('email')
    })

    it('should return 400 for missing password', async () => {
      const event = createEvent({
        email: 'test@example.com',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].field).toBe('password')
    })

    it('should return 400 for invalid email format', async () => {
      const event = createEvent({
        email: 'invalid-email',
        password: 'Password123!',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors[0].field).toBe('email')
      expect(body.errors[0].message).toContain('Invalid email format')
    })
  })

  describe('error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'ServiceUnavailableException',
        message: 'Service is unavailable',
      })

      const event = createEvent({
        email: 'test@example.com',
        password: 'Password123!',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Internal server error')
    })
  })
})
