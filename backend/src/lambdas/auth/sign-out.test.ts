import {
    CognitoIdentityProviderClient,
    GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import { handler } from './sign-out'

const cognitoMock = mockClient(CognitoIdentityProviderClient)

describe('Sign Out Lambda', () => {
  beforeEach(() => {
    cognitoMock.reset()
  })

  const createEvent = (
    accessToken?: string,
    useBody = false
  ): APIGatewayProxyEvent => {
    const event: Partial<APIGatewayProxyEvent> = {
      requestContext: {
        requestId: 'test-request-id',
      } as any,
      headers: {},
    }

    if (accessToken && !useBody) {
      event.headers = {
        Authorization: `Bearer ${accessToken}`,
      }
    } else if (accessToken && useBody) {
      event.body = JSON.stringify({ accessToken })
    }

    return event as APIGatewayProxyEvent
  }

  describe('successful sign out', () => {
    it('should sign out user with access token from Authorization header', async () => {
      cognitoMock.on(GlobalSignOutCommand).resolves({})

      const event = createEvent('valid-access-token')
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('signed out successfully')

      // Verify GlobalSignOutCommand was called
      const calls = cognitoMock.commandCalls(GlobalSignOutCommand)
      expect(calls.length).toBe(1)
      expect(calls[0].args[0].input).toMatchObject({
        AccessToken: 'valid-access-token',
      })
    })

    it('should sign out user with access token from request body', async () => {
      cognitoMock.on(GlobalSignOutCommand).resolves({})

      const event = createEvent('valid-access-token', true)
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('signed out successfully')
    })

    it('should handle lowercase authorization header', async () => {
      cognitoMock.on(GlobalSignOutCommand).resolves({})

      const event = createEvent('valid-access-token')
      event.headers = { authorization: 'Bearer valid-access-token' }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
    })
  })

  describe('validation', () => {
    it('should return 400 when no access token provided', async () => {
      const event = createEvent()

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors).toBeDefined()
      const tokenError = body.errors.find(
        (e: { field: string }) => e.field === 'accessToken'
      )
      expect(tokenError).toBeDefined()
      expect(tokenError.message).toContain('required')
    })

    it('should return 400 when Authorization header is empty', async () => {
      const event = createEvent()
      event.headers = { Authorization: '' }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
    })
  })

  describe('error handling', () => {
    it('should return 401 for invalid access token', async () => {
      cognitoMock.on(GlobalSignOutCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Invalid access token',
      })

      const event = createEvent('invalid-token')
      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invalid or expired access token')
    })

    it('should return 401 for expired access token', async () => {
      cognitoMock.on(GlobalSignOutCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Access Token has expired',
      })

      const event = createEvent('expired-token')
      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invalid or expired access token')
    })

    it('should return 500 for unexpected errors', async () => {
      cognitoMock.on(GlobalSignOutCommand).rejects({
        name: 'ServiceUnavailableException',
        message: 'Service is unavailable',
      })

      const event = createEvent('valid-token')
      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Internal server error')
    })

    it('should handle sign out even if user already signed out', async () => {
      // Cognito may return NotAuthorizedException if user already signed out
      // This should still be treated as 401, not an error
      cognitoMock.on(GlobalSignOutCommand).rejects({
        name: 'NotAuthorizedException',
        message: 'Access Token has been revoked',
      })

      const event = createEvent('revoked-token')
      const response = await handler(event)

      expect(response.statusCode).toBe(401)
    })
  })

  describe('global sign out', () => {
    it('should call GlobalSignOut command (not just SignOut)', async () => {
      cognitoMock.on(GlobalSignOutCommand).resolves({})

      const event = createEvent('valid-token')
      await handler(event)

      // Verify it's specifically GlobalSignOut (invalidates all tokens)
      const calls = cognitoMock.commandCalls(GlobalSignOutCommand)
      expect(calls.length).toBe(1)
    })

    it('should invalidate all user sessions across devices', async () => {
      cognitoMock.on(GlobalSignOutCommand).resolves({})

      const event = createEvent('device-a-token')
      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      // GlobalSignOutCommand invalidates all refresh tokens for the user
      // This means the user will need to sign in again on all devices
    })
  })
})
