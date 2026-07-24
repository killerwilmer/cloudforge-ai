import {
    BedrockRuntimeClient,
    ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import type { Architecture } from '../../shared/types'
import {
    errorResponse,
    loadAIEngineConfig,
    logger,
    successResponse,
    validationErrorResponse
} from '../../shared/utils'

// Initialize Bedrock client outside handler for reuse
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
})

// Load and validate configuration
const config = loadAIEngineConfig()

interface GenerateArchitectureRequest {
  description: string
  constraints?: {
    maxServices?: number
    excludeServices?: string[]
    region?: string
    budget?: string
  }
}

/**
 * System prompt for Claude to generate AWS architectures
 */
const SYSTEM_PROMPT = `You are an expert AWS Solutions Architect AI assistant. Your role is to analyze problem descriptions and generate optimal AWS architecture designs.

When given a problem description, you must respond with a valid JSON object representing an AWS architecture. The architecture must include:

1. **services**: An array of AWS services, each with:
   - id: unique identifier (string)
   - type: AWS service type (Lambda, APIGateway, DynamoDB, S3, SQS, SNS, RDS, ElastiCache, CloudFront, etc.)
   - name: descriptive name for the service
   - configuration: service-specific settings as a JSON object
   - position: {x, y} coordinates for visual layout

2. **connections**: An array of connections between services, each with:
   - id: unique identifier (string)
   - sourceId: id of the source service
   - targetId: id of the target service
   - type: 'sync' (synchronous like API Gateway → Lambda), 'async' (asynchronous like Lambda → SQS), or 'data' (data access like Lambda → DynamoDB)
   - protocol: optional protocol description

3. **metadata**: Architecture metadata with:
   - name: short architecture name
   - description: one-sentence description
   - region: AWS region (default: us-east-1)
   - version: 1
   - createdAt: current timestamp
   - updatedAt: current timestamp
   - tags: array of relevant tags

**IMPORTANT RULES:**
- Always respond with valid JSON only - no markdown, no explanations
- Use realistic AWS service configurations
- Ensure all connections reference existing service IDs
- Follow AWS best practices (e.g., use VPC for Lambda, enable encryption, use least privilege)
- Choose appropriate service types for the use case
- Position services logically (e.g., API Gateway at top-left, databases at bottom)

**Example Response Format:**
{
  "services": [
    {
      "id": "api-1",
      "type": "APIGateway",
      "name": "REST API",
      "configuration": {"cors": true, "throttle": {"rateLimit": 1000, "burstLimit": 2000}},
      "position": {"x": 100, "y": 100}
    },
    {
      "id": "lambda-1",
      "type": "Lambda",
      "name": "API Handler",
      "configuration": {"runtime": "nodejs20.x", "memory": 512, "timeout": 30},
      "position": {"x": 300, "y": 100}
    },
    {
      "id": "dynamodb-1",
      "type": "DynamoDB",
      "name": "Data Store",
      "configuration": {"billingMode": "PAY_PER_REQUEST", "encryption": true},
      "position": {"x": 500, "y": 250}
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "sourceId": "api-1",
      "targetId": "lambda-1",
      "type": "sync",
      "protocol": "HTTPS"
    },
    {
      "id": "conn-2",
      "sourceId": "lambda-1",
      "targetId": "dynamodb-1",
      "type": "data"
    }
  ],
  "metadata": {
    "name": "REST API with DynamoDB",
    "description": "Simple REST API backed by DynamoDB",
    "region": "us-east-1",
    "version": 1,
    "createdAt": "2026-07-24T00:00:00.000Z",
    "updatedAt": "2026-07-24T00:00:00.000Z",
    "tags": ["api", "serverless", "rest"]
  }
}`

/**
 * Generate architecture handler
 * Uses Amazon Bedrock (Claude 3.5 Sonnet) to generate AWS architecture from description
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Architecture generation request received')

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as GenerateArchitectureRequest

    // Validation
    if (!body.description || body.description.trim().length === 0) {
      return validationErrorResponse([
        { field: 'description', message: 'Description is required' },
      ])
    }

    if (body.description.length > 2000) {
      return validationErrorResponse([
        {
          field: 'description',
          message: 'Description must be 2000 characters or less',
        },
      ])
    }

    // Build user message with constraints if provided
    let userMessage = `Problem Description: ${body.description}`

    if (body.constraints) {
      userMessage += '\n\nConstraints:'
      if (body.constraints.maxServices) {
        userMessage += `\n- Maximum ${body.constraints.maxServices} services`
      }
      if (body.constraints.excludeServices) {
        userMessage += `\n- Exclude services: ${body.constraints.excludeServices.join(', ')}`
      }
      if (body.constraints.region) {
        userMessage += `\n- Deploy in region: ${body.constraints.region}`
      }
      if (body.constraints.budget) {
        userMessage += `\n- Budget constraint: ${body.constraints.budget}`
      }
    }

    logger.info('Invoking Bedrock model', {
      model: config.bedrock.modelId,
      descriptionLength: body.description.length,
    })

    // Call Bedrock API with Claude 3.5 Sonnet
    const command = new ConverseCommand({
      modelId: config.bedrock.modelId,
      messages: [
        {
          role: 'user',
          content: [{ text: userMessage }],
        },
      ],
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7, // Balanced creativity (Claude Haiku 4.5 compatible)
      },
    })

    const response = await bedrockClient.send(command)

    if (!response.output || !response.output.message) {
      logger.error('Bedrock returned no output')
      return errorResponse(500, 'AI model did not return a response')
    }

    // Extract text from response
    const content = response.output.message.content
    if (!content || content.length === 0) {
      logger.error('Bedrock returned empty content')
      return errorResponse(500, 'AI model returned empty response')
    }

    const textContent = content[0]
    if (!textContent || !('text' in textContent)) {
      logger.error('Bedrock content has no text field')
      return errorResponse(500, 'AI model response format invalid')
    }

    const architectureText = textContent.text
    if (!architectureText) {
      logger.error('Bedrock text content is empty')
      return errorResponse(500, 'AI model returned empty text')
    }

    logger.info('Parsing Bedrock response', {
      responseLength: architectureText.length,
    })

    // Parse JSON response (strip markdown code blocks if present)
    let architecture: Architecture
    try {
      let jsonText = architectureText.trim()
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '')
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '')
      }
      
      architecture = JSON.parse(jsonText) as Architecture
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        response: architectureText.substring(0, 500),
      })
      return errorResponse(
        500,
        'AI generated invalid response format. Please try again.'
      )
    }

    // Validate architecture structure
    if (!architecture.services || !Array.isArray(architecture.services)) {
      return errorResponse(500, 'Generated architecture missing services array')
    }

    if (!architecture.connections || !Array.isArray(architecture.connections)) {
      return errorResponse(500, 'Generated architecture missing connections array')
    }

    if (!architecture.metadata || !architecture.metadata.name) {
      return errorResponse(500, 'Generated architecture missing metadata')
    }

    // Validate service IDs are unique
    const serviceIds = new Set<string>()
    for (const service of architecture.services) {
      if (serviceIds.has(service.id)) {
        return errorResponse(500, `Duplicate service ID: ${service.id}`)
      }
      serviceIds.add(service.id)
    }

    // Validate connections reference existing services
    for (const connection of architecture.connections) {
      if (!serviceIds.has(connection.sourceId)) {
        return errorResponse(
          500,
          `Connection references non-existent source: ${connection.sourceId}`
        )
      }
      if (!serviceIds.has(connection.targetId)) {
        return errorResponse(
          500,
          `Connection references non-existent target: ${connection.targetId}`
        )
      }
    }

    logger.info('Architecture generated successfully', {
      serviceCount: architecture.services.length,
      connectionCount: architecture.connections.length,
      architectureName: architecture.metadata.name,
    })

    return successResponse({
      architecture,
      usage: {
        inputTokens: response.usage?.inputTokens || 0,
        outputTokens: response.usage?.outputTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
      },
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Architecture generation failed', {
      error: err.message,
      errorName: err.name,
    })

    // Handle specific Bedrock errors
    if (err.name === 'ValidationException') {
      return errorResponse(400, 'Invalid request to AI model')
    }

    if (err.name === 'ThrottlingException') {
      return errorResponse(
        429,
        'AI service is currently busy. Please try again in a moment.'
      )
    }

    if (err.name === 'ServiceQuotaExceededException') {
      return errorResponse(429, 'AI service quota exceeded. Please try again later.')
    }

    return errorResponse(500, 'Internal server error')
  }
}
