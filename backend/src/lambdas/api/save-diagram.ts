import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
  errorResponse,
  logger,
  successResponse,
  validationErrorResponse,
} from '../../shared/utils'
import { Architecture } from '../../shared/types'

// Initialize AWS clients outside handler for reuse
const s3Client = new S3Client({ region: process.env.AWS_REGION })
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
)

const DIAGRAMS_TABLE = process.env.DYNAMODB_DIAGRAMS_TABLE!
const DIAGRAMS_BUCKET = process.env.S3_DIAGRAMS_BUCKET!

interface SaveDiagramRequest {
  diagramId?: string // Optional - if not provided, create new diagram
  name: string
  architecture: Architecture
  changeDescription?: string
  tags?: string[]
}

/**
 * Save diagram handler
 * Creates new diagram or updates existing diagram with new version
 * POST /api/diagrams
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Save diagram request received')

    // Extract userId from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub
    if (!userId) {
      return errorResponse(401, 'User not authenticated')
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}') as SaveDiagramRequest

    const errors: Array<{ field: string; message: string }> = []

    if (!body.name || body.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Diagram name is required' })
    } else if (body.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Diagram name must be 100 characters or less',
      })
    }

    if (!body.architecture) {
      errors.push({
        field: 'architecture',
        message: 'Architecture data is required',
      })
    } else {
      // Validate architecture structure
      if (!body.architecture.services || !Array.isArray(body.architecture.services)) {
        errors.push({
          field: 'architecture.services',
          message: 'Architecture must have services array',
        })
      }
      if (
        !body.architecture.connections ||
        !Array.isArray(body.architecture.connections)
      ) {
        errors.push({
          field: 'architecture.connections',
          message: 'Architecture must have connections array',
        })
      }
      if (!body.architecture.metadata) {
        errors.push({
          field: 'architecture.metadata',
          message: 'Architecture must have metadata',
        })
      }
    }

    if (errors.length > 0) {
      return validationErrorResponse(errors)
    }

    // Generate or use provided diagramId
    const diagramId =
      body.diagramId || `diagram-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // Determine next version number
    let version = 1
    if (body.diagramId) {
      // Get latest version of existing diagram
      try {
        const getCommand = new GetCommand({
          TableName: DIAGRAMS_TABLE,
          Key: { diagramId, version: 0 }, // version 0 stores latest pointer
        })
        const existing = await dynamoClient.send(getCommand)
        if (existing.Item) {
          version = (existing.Item.latestVersion || 0) + 1
        }
      } catch (err) {
        logger.error('Error fetching latest version', { error: err })
        // Continue with version 1 if fetch fails
      }
    }

    const now = new Date().toISOString()
    const s3Key = `diagrams/${userId}/${diagramId}/v${version}.json`

    // Store architecture JSON in S3
    logger.info('Storing architecture in S3', { s3Key })
    const putObjectCommand = new PutObjectCommand({
      Bucket: DIAGRAMS_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(body.architecture, null, 2),
      ContentType: 'application/json',
      Metadata: {
        userId,
        diagramId,
        version: version.toString(),
        name: body.name,
      },
    })
    await s3Client.send(putObjectCommand)

    // Store metadata in DynamoDB
    logger.info('Storing diagram metadata in DynamoDB', { diagramId, version })

    // Create version record
    const versionRecord = {
      diagramId,
      version,
      userId,
      name: body.name.trim(),
      s3Key,
      tags: body.tags || [],
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
      changeDescription: body.changeDescription,
      servicesCount: body.architecture.services.length,
      connectionsCount: body.architecture.connections.length,
    }

    await dynamoClient.send(
      new PutCommand({
        TableName: DIAGRAMS_TABLE,
        Item: versionRecord,
      })
    )

    // Update version 0 (latest pointer)
    await dynamoClient.send(
      new PutCommand({
        TableName: DIAGRAMS_TABLE,
        Item: {
          diagramId,
          version: 0,
          userId,
          latestVersion: version,
          name: body.name.trim(),
          s3Key,
          updatedAt: now,
        },
      })
    )

    logger.info('Diagram saved successfully', { diagramId, version })

    return successResponse({
      diagramId,
      version,
      name: body.name.trim(),
      s3Key,
      createdAt: now,
      message: version === 1 ? 'Diagram created successfully' : 'Diagram updated successfully',
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Save diagram failed', {
      error: err.message,
      errorName: err.name,
    })

    return errorResponse(500, 'Failed to save diagram')
  }
}
