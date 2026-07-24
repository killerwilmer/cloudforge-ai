import { APIGatewayProxyEvent } from 'aws-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { handler } from './refresh-token'

const cognitoMock = mockClient(CognitoIdentityProviderClient)

describe('Refresh Token Lambda', () => {
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

  describe('successful token refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      const mockTokens = {
        AccessToken: 'new-access-token',
        IdToken: 'new-id-token',
        ExpiresIn: 3600,
      }

      cognitoMock.on(InitiateAuthCommand).resolves({
        AuthenticationResult: mockTokens,
      })

      const event = createEvent({
        refreshToken: 'valid-refresh-token',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.accessToken).toBe(mockTokens.AccessToken)
      expect(body.idToken).toBe(mockTokens.IdToken)
      expect(body.expiresIn).toBe(mockTokens.ExpiresIn)
      expect(body.refreshToken).toBeUndefined() // Refresh token not returned
    })
  })

  describe('validation', () => {
    it('should return 400 for missing refresh token', async () => {
      const event = createEvent({})

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].field).toBe('refreshToken')
    })
  })

  describe('error handling', () => {
    it('should return 401 for invalid refresh token', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Invalid refresh token',
      })

      const event = createEvent({
        refreshToken: 'invalid-token',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invalid or expired refresh token')
    })

    it('should return 401 for expired refresh token', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Refresh token has expired',
      })

      const event = createEvent({
        refreshToken: 'expired-token',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invalid or expired refresh token')
    })

    it('should return 500 for unexpected errors', async () => {
      cognitoMock.on(InitiateAuthCommand).rejects({
        name: 'ServiceUnavailableException',
        message: 'Service is unavailable',
      })

      const event = createEvent({
        refreshToken: 'valid-token',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Internal server error')
    })
  })
})
