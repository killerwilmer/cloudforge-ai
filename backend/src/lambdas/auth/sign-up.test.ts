import {
    CognitoIdentityProviderClient,
    SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent } from 'aws-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import { handler } from './sign-up'

const cognitoMock = mockClient(CognitoIdentityProviderClient)

describe('Sign Up Lambda', () => {
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

  describe('successful registration', () => {
    it('should register new user with valid data', async () => {
      cognitoMock.on(SignUpCommand).resolves({
        UserSub: 'test-user-sub',
        UserConfirmed: false,
      })

      const event = createEvent({
        email: 'newuser@example.com',
        password: 'ValidPassword123!',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.userSub).toBe('test-user-sub')
      expect(body.userConfirmed).toBe(false)
      expect(body.message).toContain('verify your email')
    })
  })

  describe('validation', () => {
    it('should return 400 for missing email', async () => {
      const event = createEvent({
        password: 'Password123!',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors).toBeDefined()
      const emailError = body.errors.find((e: { field: string }) => e.field === 'email')
      expect(emailError).toBeDefined()
    })

    it('should return 400 for invalid email format', async () => {
      const event = createEvent({
        email: 'invalid-email',
        password: 'Password123!',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const emailError = body.errors.find((e: { field: string }) => e.field === 'email')
      expect(emailError.message).toContain('Invalid email format')
    })

    it('should return 400 for missing password', async () => {
      const event = createEvent({
        email: 'test@example.com',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const passwordError = body.errors.find((e: { field: string }) => e.field === 'password')
      expect(passwordError).toBeDefined()
    })

    it('should return 400 for short password', async () => {
      const event = createEvent({
        email: 'test@example.com',
        password: 'Short1!',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const passwordError = body.errors.find((e: { field: string }) => e.field === 'password')
      expect(passwordError.message).toContain('at least 8 characters')
    })

    it('should return 400 for missing name', async () => {
      const event = createEvent({
        email: 'test@example.com',
        password: 'Password123!',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      const nameError = body.errors.find((e: { field: string }) => e.field === 'name')
      expect(nameError).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should return 409 for existing user', async () => {
      cognitoMock.on(SignUpCommand).rejects({
        name: 'UsernameExistsException',
        message: 'User already exists',
      })

      const event = createEvent({
        email: 'existing@example.com',
        password: 'Password123!',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('already exists')
    })

    it('should return 400 for invalid password requirements', async () => {
      cognitoMock.on(SignUpCommand).rejects({
        name: 'InvalidPasswordException',
        message: 'Password does not meet requirements',
      })

      const event = createEvent({
        email: 'test@example.com',
        password: 'weakpassword',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Password does not meet requirements')
    })

    it('should return 500 for unexpected errors', async () => {
      cognitoMock.on(SignUpCommand).rejects({
        name: 'ServiceUnavailableException',
        message: 'Service is unavailable',
      })

      const event = createEvent({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'John Doe',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Internal server error')
    })
  })
})
