import { APIGatewayProxyEvent } from 'aws-lambda'
import { mockClient } from 'aws-sdk-client-mock'
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { handler } from './generate-architecture'

const bedrockMock = mockClient(BedrockRuntimeClient)

describe('Generate Architecture Lambda', () => {
  beforeEach(() => {
    bedrockMock.reset()
    process.env.BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    process.env.BEDROCK_REGION = 'us-east-1'
    process.env.AWS_REGION = 'us-east-1'
    process.env.LOG_LEVEL = 'INFO'
  })

  const createEvent = (body: unknown): APIGatewayProxyEvent =>
    ({
      body: JSON.stringify(body),
      requestContext: {
        requestId: 'test-request-id',
      },
    }) as APIGatewayProxyEvent

  const createMockArchitecture = () => ({
    services: [
      {
        id: 'api-1',
        type: 'APIGateway',
        name: 'REST API',
        configuration: { cors: true, throttle: { rateLimit: 1000 } },
        position: { x: 100, y: 100 },
      },
      {
        id: 'lambda-1',
        type: 'Lambda',
        name: 'API Handler',
        configuration: { runtime: 'nodejs20.x', memory: 512, timeout: 30 },
        position: { x: 300, y: 100 },
      },
      {
        id: 'dynamodb-1',
        type: 'DynamoDB',
        name: 'Data Store',
        configuration: { billingMode: 'PAY_PER_REQUEST', encryption: true },
        position: { x: 500, y: 250 },
      },
    ],
    connections: [
      {
        id: 'conn-1',
        sourceId: 'api-1',
        targetId: 'lambda-1',
        type: 'sync' as const,
        protocol: 'HTTPS',
      },
      {
        id: 'conn-2',
        sourceId: 'lambda-1',
        targetId: 'dynamodb-1',
        type: 'data' as const,
      },
    ],
    metadata: {
      name: 'REST API with DynamoDB',
      description: 'Simple REST API backed by DynamoDB',
      region: 'us-east-1',
      version: 1,
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:00.000Z',
      tags: ['api', 'serverless', 'rest'],
    },
  })

  describe('successful generation', () => {
    it('should generate architecture for simple REST API description', async () => {
      const mockArchitecture = createMockArchitecture()

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: JSON.stringify(mockArchitecture) }],
          },
        },
        usage: {
          inputTokens: 500,
          outputTokens: 1000,
          totalTokens: 1500,
        },
      })

      const event = createEvent({
        description:
          'I need a serverless REST API to manage user tasks. Users should be able to create, read, update, and delete tasks. The API needs authentication and should store data persistently.',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.architecture).toBeDefined()
      expect(body.architecture.services).toHaveLength(3)
      expect(body.architecture.connections).toHaveLength(2)
      expect(body.architecture.metadata.name).toBe('REST API with DynamoDB')
      expect(body.usage).toBeDefined()
      expect(body.usage.totalTokens).toBe(1500)
    })

    it('should generate architecture with constraints', async () => {
      const mockArchitecture = createMockArchitecture()

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: JSON.stringify(mockArchitecture) }],
          },
        },
        usage: {
          inputTokens: 600,
          outputTokens: 1200,
          totalTokens: 1800,
        },
      })

      const event = createEvent({
        description: 'Build a real-time notification system',
        constraints: {
          maxServices: 5,
          excludeServices: ['RDS'],
          region: 'eu-west-1',
          budget: '$100/month',
        },
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.architecture.services.length).toBeLessThanOrEqual(5)
      expect(body.usage.totalTokens).toBe(1800)
    })

    it('should validate generated architecture structure', async () => {
      const mockArchitecture = createMockArchitecture()

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: JSON.stringify(mockArchitecture) }],
          },
        },
        usage: {
          inputTokens: 500,
          outputTokens: 1000,
          totalTokens: 1500,
        },
      })

      const event = createEvent({
        description: 'Create a data processing pipeline',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)

      // Validate architecture has required fields
      expect(body.architecture.services).toBeInstanceOf(Array)
      expect(body.architecture.connections).toBeInstanceOf(Array)
      expect(body.architecture.metadata).toBeDefined()
      expect(body.architecture.metadata.name).toBeTruthy()
      expect(body.architecture.metadata.version).toBe(1)

      // Validate services have required fields
      body.architecture.services.forEach((service: unknown) => {
        const s = service as { id: string; type: string; name: string }
        expect(s.id).toBeTruthy()
        expect(s.type).toBeTruthy()
        expect(s.name).toBeTruthy()
      })

      // Validate connections reference existing services
      const serviceIds = new Set(
        body.architecture.services.map((s: { id: string }) => s.id)
      )
      body.architecture.connections.forEach((conn: unknown) => {
        const c = conn as { sourceId: string; targetId: string }
        expect(serviceIds.has(c.sourceId)).toBe(true)
        expect(serviceIds.has(c.targetId)).toBe(true)
      })
    })
  })

  describe('validation', () => {
    it('should return 400 for missing description', async () => {
      const event = createEvent({})

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].field).toBe('description')
      expect(body.errors[0].message).toContain('required')
    })

    it('should return 400 for empty description', async () => {
      const event = createEvent({
        description: '   ',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors[0].field).toBe('description')
    })

    it('should return 400 for description exceeding 2000 characters', async () => {
      const event = createEvent({
        description: 'a'.repeat(2001),
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.errors[0].field).toBe('description')
      expect(body.errors[0].message).toContain('2000 characters')
    })
  })

  describe('error handling', () => {
    it('should return 500 when Bedrock returns no output', async () => {
      bedrockMock.on(ConverseCommand).resolves({
        output: undefined,
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('did not return a response')
    })

    it('should return 500 when Bedrock returns invalid JSON', async () => {
      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: 'This is not valid JSON' }],
          },
        },
        usage: {
          inputTokens: 500,
          outputTokens: 100,
          totalTokens: 600,
        },
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('invalid response format')
    })

    it('should return 500 when architecture is missing services', async () => {
      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [
              {
                text: JSON.stringify({
                  connections: [],
                  metadata: { name: 'Test', version: 1 },
                }),
              },
            ],
          },
        },
        usage: {
          inputTokens: 500,
          outputTokens: 100,
          totalTokens: 600,
        },
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('missing services array')
    })

    it('should return 500 for duplicate service IDs', async () => {
      const invalidArchitecture = {
        services: [
          {
            id: 'service-1',
            type: 'Lambda',
            name: 'Function 1',
            configuration: {},
            position: { x: 0, y: 0 },
          },
          {
            id: 'service-1', // Duplicate ID
            type: 'DynamoDB',
            name: 'Table 1',
            configuration: {},
            position: { x: 100, y: 100 },
          },
        ],
        connections: [],
        metadata: {
          name: 'Test',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      }

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: JSON.stringify(invalidArchitecture) }],
          },
        },
        usage: {
          inputTokens: 500,
          outputTokens: 500,
          totalTokens: 1000,
        },
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Duplicate service ID')
    })

    it('should return 500 for connections with non-existent service references', async () => {
      const invalidArchitecture = {
        services: [
          {
            id: 'lambda-1',
            type: 'Lambda',
            name: 'Function',
            configuration: {},
            position: { x: 0, y: 0 },
          },
        ],
        connections: [
          {
            id: 'conn-1',
            sourceId: 'lambda-1',
            targetId: 'non-existent-service', // Invalid reference
            type: 'sync',
          },
        ],
        metadata: {
          name: 'Test',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      }

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: JSON.stringify(invalidArchitecture) }],
          },
        },
        usage: {
          inputTokens: 500,
          outputTokens: 500,
          totalTokens: 1000,
        },
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('non-existent target')
    })

    it('should return 429 for ThrottlingException', async () => {
      bedrockMock.on(ConverseCommand).rejects({
        name: 'ThrottlingException',
        message: 'Rate exceeded',
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(429)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('busy')
    })

    it('should return 429 for ServiceQuotaExceededException', async () => {
      bedrockMock.on(ConverseCommand).rejects({
        name: 'ServiceQuotaExceededException',
        message: 'Quota exceeded',
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(429)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('quota exceeded')
    })

    it('should return 400 for ValidationException', async () => {
      bedrockMock.on(ConverseCommand).rejects({
        name: 'ValidationException',
        message: 'Invalid request',
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.message).toContain('Invalid request')
    })

    it('should return 500 for unexpected errors', async () => {
      bedrockMock.on(ConverseCommand).rejects({
        name: 'UnknownException',
        message: 'Something went wrong',
      })

      const event = createEvent({
        description: 'Build a web application',
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Internal server error')
    })
  })

  describe('timeout scenarios', () => {
    it('should handle long descriptions without timing out', async () => {
      const mockArchitecture = createMockArchitecture()

      bedrockMock.on(ConverseCommand).resolves({
        output: {
          message: {
            role: 'assistant',
            content: [{ text: JSON.stringify(mockArchitecture) }],
          },
        },
        usage: {
          inputTokens: 1500,
          outputTokens: 2000,
          totalTokens: 3500,
        },
      })

      // Long but valid description
      const longDescription =
        'I need a complex microservices architecture for an e-commerce platform. ' +
        'The system should handle user authentication, product catalog management, ' +
        'shopping cart functionality, order processing, payment integration, ' +
        'inventory management, real-time notifications, and analytics. ' +
        'It needs to support high traffic with auto-scaling, implement caching ' +
        'for better performance, use message queues for asynchronous processing, ' +
        'and ensure data consistency across services. The architecture should ' +
        'follow AWS best practices for security and cost optimization.'

      const event = createEvent({
        description: longDescription,
      })

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.architecture).toBeDefined()
      expect(body.usage.totalTokens).toBeGreaterThan(1000)
    })
  })
})
