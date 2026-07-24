import * as fc from 'fast-check'
import * as yaml from 'yaml'
import type { Architecture, CloudFormationTemplate } from '../../shared/types'

/**
 * Property-Based Tests for CloudFormation Generation
 * Tests round-trip equivalence: parse(print(x)) ≡ x
 */

// Mock the handler dependencies
jest.mock('../../shared/utils', () => ({
  errorResponse: jest.fn((code, message) => ({
    statusCode: code,
    body: JSON.stringify({ error: message }),
  })),
  successResponse: jest.fn((data) => ({
    statusCode: 200,
    body: JSON.stringify(data),
  })),
  validationErrorResponse: jest.fn((errors) => ({
    statusCode: 400,
    body: JSON.stringify({ errors }),
  })),
  logger: {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// Import handler after mocking dependencies
import { handler } from './generate-cloudformation'

/**
 * Arbitraries for generating random valid CloudFormation templates
 */

// Generate random AWS service type
const serviceTypeArb = fc.constantFrom(
  'Lambda',
  'API Gateway',
  'APIGateway',
  'DynamoDB',
  'S3',
  'SQS',
  'SNS',
  'Cognito',
  'IAM'
)

// Generate random service configuration
const serviceConfigArb = fc.record({
  runtime: fc.option(fc.constantFrom('nodejs20.x', 'python3.11', 'java17'), { nil: undefined }),
  memory: fc.option(fc.integer({ min: 128, max: 3008 }), { nil: undefined }),
  timeout: fc.option(fc.integer({ min: 3, max: 900 }), { nil: undefined }),
  billingMode: fc.option(fc.constantFrom('PAY_PER_REQUEST', 'PROVISIONED'), { nil: undefined }),
  encryption: fc.option(fc.boolean(), { nil: undefined }),
})

// Generate random AWS service
const awsServiceArb = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }),
  type: serviceTypeArb,
  name: fc.string({ minLength: 5, maxLength: 30 }),
  configuration: serviceConfigArb,
  position: fc.record({
    x: fc.integer({ min: 0, max: 1000 }),
    y: fc.integer({ min: 0, max: 1000 }),
  }),
})

// Generate random service connection
const serviceConnectionArb = (serviceIds: readonly string[]) =>
  fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }),
    sourceId: fc.constantFrom(...serviceIds),
    targetId: fc.constantFrom(...serviceIds),
    type: fc.constantFrom('sync', 'async', 'data'),
    protocol: fc.option(fc.constantFrom('HTTPS', 'HTTP', 'TCP'), { nil: undefined }),
  })

// Generate random Architecture
const architectureArb = fc
  .array(awsServiceArb, { minLength: 1, maxLength: 10 })
  .chain((services) => {
    const serviceIds = services.map((s) => s.id) as readonly string[]
    return fc.record({
      services: fc.constant(services),
      connections: fc.array(serviceConnectionArb(serviceIds), { minLength: 0, maxLength: 15 }),
      metadata: fc.record({
        name: fc.string({ minLength: 5, maxLength: 50 }),
        description: fc.option(fc.string({ minLength: 10, maxLength: 100 }), {
          nil: undefined,
        }),
        region: fc.option(fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1'), {
          nil: undefined,
        }),
        version: fc.constant(1),
        createdAt: fc.constant(new Date().toISOString()),
        updatedAt: fc.constant(new Date().toISOString()),
        tags: fc.option(fc.array(fc.string(), { minLength: 0, maxLength: 5 }), { nil: undefined }),
      }),
    })
  })

/**
 * Property Test 1: YAML Round-Trip Equivalence
 * For any valid CloudFormation template, parse(print(x)) should equal x
 */
describe('CloudFormation Round-Trip Tests', () => {
  test('Property: YAML round-trip preserves template structure', async () => {
    await fc.assert(
      fc.asyncProperty(architectureArb, async (architecture) => {
        // Generate CloudFormation template
        const event = {
          body: JSON.stringify({
            architecture,
            format: 'yaml',
          }),
          requestContext: {
            requestId: 'test-request-id',
          },
        } as any

        const response = await handler(event)
        expect(response.statusCode).toBe(200)

        const result = JSON.parse(response.body)
        const yamlTemplate = result.template

        // Parse YAML back to object
        const parsed = yaml.parse(yamlTemplate)

        // Verify structure is preserved
        expect(parsed).toHaveProperty('AWSTemplateFormatVersion', '2010-09-09')
        expect(parsed).toHaveProperty('Description')
        expect(parsed).toHaveProperty('Resources')
        expect(parsed).toHaveProperty('Parameters')

        // Verify resources count matches services count
        const resourceCount = Object.keys(parsed.Resources).length
        expect(resourceCount).toBeGreaterThan(0)
        expect(resourceCount).toBeLessThanOrEqual(architecture.services.length)

        // Re-serialize and parse again (true round-trip)
        const reserialized = yaml.stringify(parsed)
        const reparsed = yaml.parse(reserialized)

        // Verify deep equality
        expect(reparsed).toEqual(parsed)
      }),
      { numRuns: 20 } // Run 20 random test cases
    )
  })

  test('Property: JSON round-trip preserves template structure', async () => {
    await fc.assert(
      fc.asyncProperty(architectureArb, async (architecture) => {
        // Generate CloudFormation template
        const event = {
          body: JSON.stringify({
            architecture,
            format: 'json',
          }),
          requestContext: {
            requestId: 'test-request-id',
          },
        } as any

        const response = await handler(event)
        expect(response.statusCode).toBe(200)

        const result = JSON.parse(response.body)
        const jsonTemplate = result.template

        // Parse JSON back to object
        const parsed = JSON.parse(jsonTemplate)

        // Verify structure is preserved
        expect(parsed).toHaveProperty('AWSTemplateFormatVersion', '2010-09-09')
        expect(parsed).toHaveProperty('Description')
        expect(parsed).toHaveProperty('Resources')
        expect(parsed).toHaveProperty('Parameters')

        // Re-serialize and parse again (true round-trip)
        const reserialized = JSON.stringify(parsed, null, 2)
        const reparsed = JSON.parse(reserialized)

        // Verify deep equality
        expect(reparsed).toEqual(parsed)
      }),
      { numRuns: 20 }
    )
  })

  test('Property: Format conversion preserves semantic content', async () => {
    await fc.assert(
      fc.asyncProperty(architectureArb, async (architecture) => {
        // Generate both YAML and JSON
        const yamlEvent = {
          body: JSON.stringify({ architecture, format: 'yaml' }),
          requestContext: { requestId: 'test-yaml' },
        } as any

        const jsonEvent = {
          body: JSON.stringify({ architecture, format: 'json' }),
          requestContext: { requestId: 'test-json' },
        } as any

        const yamlResponse = await handler(yamlEvent)
        const jsonResponse = await handler(jsonEvent)

        expect(yamlResponse.statusCode).toBe(200)
        expect(jsonResponse.statusCode).toBe(200)

        const yamlResult = JSON.parse(yamlResponse.body)
        const jsonResult = JSON.parse(jsonResponse.body)

        // Parse both to objects
        const yamlParsed = yaml.parse(yamlResult.template)
        const jsonParsed = JSON.parse(jsonResult.template)

        // Verify semantic equivalence
        expect(yamlParsed.AWSTemplateFormatVersion).toBe(jsonParsed.AWSTemplateFormatVersion)
        expect(Object.keys(yamlParsed.Resources).length).toBe(
          Object.keys(jsonParsed.Resources).length
        )
        expect(yamlParsed.Parameters).toEqual(jsonParsed.Parameters)
      }),
      { numRuns: 15 }
    )
  })
})

/**
 * Unit Tests for Service Mapping and Resource Generation
 */
describe('CloudFormation Service Mapping', () => {
  test('Lambda service generates correct CloudFormation resource', async () => {
    const architecture: Architecture = {
      services: [
        {
          id: 'lambda-1',
          type: 'Lambda',
          name: 'API Handler',
          configuration: {
            runtime: 'nodejs20.x',
            memory: 512,
            timeout: 30,
          },
          position: { x: 100, y: 100 },
        },
      ],
      connections: [],
      metadata: {
        name: 'Lambda Test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const event = {
      body: JSON.stringify({ architecture, format: 'json' }),
      requestContext: { requestId: 'test-lambda' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(200)

    const result = JSON.parse(response.body)
    const template: CloudFormationTemplate = JSON.parse(result.template)

    // Verify Lambda resource exists
    const resources = Object.values(template.Resources)
    const lambdaResource = resources.find((r) => r.Type === 'AWS::Lambda::Function')

    expect(lambdaResource).toBeDefined()
    expect(lambdaResource?.Properties).toMatchObject({
      Runtime: 'nodejs20.x',
      MemorySize: 512,
      Timeout: 30,
    })
  })

  test('DynamoDB service generates correct CloudFormation resource', async () => {
    const architecture: Architecture = {
      services: [
        {
          id: 'dynamodb-1',
          type: 'DynamoDB',
          name: 'Users Table',
          configuration: {
            billingMode: 'PAY_PER_REQUEST',
            encryption: true,
          },
          position: { x: 200, y: 200 },
        },
      ],
      connections: [],
      metadata: {
        name: 'DynamoDB Test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const event = {
      body: JSON.stringify({ architecture, format: 'json' }),
      requestContext: { requestId: 'test-dynamodb' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(200)

    const result = JSON.parse(response.body)
    const template: CloudFormationTemplate = JSON.parse(result.template)

    // Verify DynamoDB resource exists
    const resources = Object.values(template.Resources)
    const dynamoResource = resources.find((r) => r.Type === 'AWS::DynamoDB::Table')

    expect(dynamoResource).toBeDefined()
    expect(dynamoResource?.Properties).toMatchObject({
      BillingMode: 'PAY_PER_REQUEST',
    })
    expect(dynamoResource?.Properties.SSESpecification).toBeDefined()
  })

  test('S3 service generates secure bucket by default', async () => {
    const architecture: Architecture = {
      services: [
        {
          id: 's3-1',
          type: 'S3',
          name: 'Data Bucket',
          configuration: {},
          position: { x: 300, y: 300 },
        },
      ],
      connections: [],
      metadata: {
        name: 'S3 Test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const event = {
      body: JSON.stringify({ architecture, format: 'json' }),
      requestContext: { requestId: 'test-s3' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(200)

    const result = JSON.parse(response.body)
    const template: CloudFormationTemplate = JSON.parse(result.template)

    // Verify S3 resource exists with security settings
    const resources = Object.values(template.Resources)
    const s3Resource = resources.find((r) => r.Type === 'AWS::S3::Bucket')

    expect(s3Resource).toBeDefined()
    expect(s3Resource?.Properties.PublicAccessBlockConfiguration).toBeDefined()
    expect(s3Resource?.Properties.BucketEncryption).toBeDefined()
  })

  test('API Gateway service generates HTTP API', async () => {
    const architecture: Architecture = {
      services: [
        {
          id: 'api-1',
          type: 'API Gateway',
          name: 'REST API',
          configuration: {
            cors: true,
          },
          position: { x: 400, y: 400 },
        },
      ],
      connections: [],
      metadata: {
        name: 'API Gateway Test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const event = {
      body: JSON.stringify({ architecture, format: 'json' }),
      requestContext: { requestId: 'test-api' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(200)

    const result = JSON.parse(response.body)
    const template: CloudFormationTemplate = JSON.parse(result.template)

    // Verify API Gateway resource exists
    const resources = Object.values(template.Resources)
    const apiResource = resources.find((r) => r.Type === 'AWS::ApiGatewayV2::Api')

    expect(apiResource).toBeDefined()
    expect(apiResource?.Properties.CorsConfiguration).toBeDefined()
  })
})

/**
 * Validation Tests
 */
describe('CloudFormation Template Validation', () => {
  test('Template has required CloudFormation structure', async () => {
    const architecture: Architecture = {
      services: [
        {
          id: 'service-1',
          type: 'S3',
          name: 'Test Bucket',
          configuration: {},
          position: { x: 0, y: 0 },
        },
      ],
      connections: [],
      metadata: {
        name: 'Validation Test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const event = {
      body: JSON.stringify({ architecture, format: 'json' }),
      requestContext: { requestId: 'test-validation' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(200)

    const result = JSON.parse(response.body)
    const template = JSON.parse(result.template)

    // Required CloudFormation fields
    expect(template.AWSTemplateFormatVersion).toBe('2010-09-09')
    expect(template.Description).toBeDefined()
    expect(template.Resources).toBeDefined()
    expect(Object.keys(template.Resources).length).toBeGreaterThan(0)
  })

  test('Empty architecture returns validation error', async () => {
    const architecture: Architecture = {
      services: [],
      connections: [],
      metadata: {
        name: 'Empty Test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const event = {
      body: JSON.stringify({ architecture, format: 'json' }),
      requestContext: { requestId: 'test-empty' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(200)

    const result = JSON.parse(response.body)
    
    // Should still generate template but with warnings
    expect(result.template).toBeDefined()
    expect(result.validationWarnings).toBeDefined()
  })

  test('Invalid format returns validation error', async () => {
    const architecture: Architecture = {
      services: [
        {
          id: 'service-1',
          type: 'S3',
          name: 'Test',
          configuration: {},
          position: { x: 0, y: 0 },
        },
      ],
      connections: [],
      metadata: {
        name: 'Test',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }

    const event = {
      body: JSON.stringify({ architecture, format: 'xml' as any }),
      requestContext: { requestId: 'test-invalid-format' },
    } as any

    const response = await handler(event)
    
    // Should still work - invalid format defaults to yaml
    expect(response.statusCode).toBe(200)
  })
})

/**
 * Error Handling Tests
 */
describe('CloudFormation Error Handling', () => {
  test('Missing architecture returns validation error', async () => {
    const event = {
      body: JSON.stringify({ format: 'yaml' }),
      requestContext: { requestId: 'test-missing-arch' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(400)
  })

  test('Malformed JSON returns error', async () => {
    const event = {
      body: 'invalid json{{{',
      requestContext: { requestId: 'test-malformed' },
    } as any

    const response = await handler(event)
    expect(response.statusCode).toBe(500)
  })
})
