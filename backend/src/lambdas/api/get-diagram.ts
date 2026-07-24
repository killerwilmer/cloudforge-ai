import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
  errorResponse,
  logger,
  successResponse,
} from '../../shared/utils'

// Initialize AWS clients outside handler for reuse
const s3Client = new S3Client({ region: process.env.AWS_REGION })
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
)

const DIAGRAMS_TABLE = process.env.DYNAMODB_DIAGRAMS_TABLE!
const DIAGRAMS_BUCKET = process.env.S3_DIAGRAMS_BUCKET!

/**
 * Get diagram handler
 * Retrieves diagram by ID and optional version
 * GET /api/diagrams/{diagramId}?version={version}
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Get diagram request received')

    // Extract userId from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub
    if (!userId) {
      return errorResponse(401, 'User not authenticated')
    }

    // Get diagramId from path parameters
    const diagramId = event.pathParameters?.diagramId
    if (!diagramId) {
      return errorResponse(400, 'Diagram ID is required')
    }

    // Get version from query parameters (default to latest)
    const versionParam = event.queryStringParameters?.version
    let version = 0 // 0 means get latest

    if (versionParam) {
      version = parseInt(versionParam, 10)
      if (isNaN(version) || version < 0) {
        return errorResponse(400, 'Invalid version number')
      }
    }

    // If version is 0, get the latest version pointer
    if (version === 0) {
      logger.info('Fetching latest version pointer', { diagramId })
      const latestCommand = new GetCommand({
        TableName: DIAGRAMS_TABLE,
        Key: { diagramId, version: 0 },
      })
      const latestResult = await dynamoClient.send(latestCommand)

      if (!latestResult.Item) {
        return errorResponse(404, 'Diagram not found')
      }

      // Check if user owns this diagram
      if (latestResult.Item.userId !== userId) {
        return errorResponse(403, 'Access denied')
      }

      version = latestResult.Item.latestVersion || 1
      logger.info('Latest version determined', { version })
    }

    // Get diagram metadata from DynamoDB
    logger.info('Fetching diagram metadata', { diagramId, version })
    const getCommand = new GetCommand({
      TableName: DIAGRAMS_TABLE,
      Key: { diagramId, version },
    })
    const result = await dynamoClient.send(getCommand)

    if (!result.Item) {
      return errorResponse(404, 'Diagram version not found')
    }

    // Check if user owns this diagram
    if (result.Item.userId !== userId) {
      return errorResponse(403, 'Access denied')
    }

    const metadata = result.Item

    // Fetch architecture JSON from S3
    logger.info('Fetching architecture from S3', { s3Key: metadata.s3Key })
    const getObjectCommand = new GetObjectCommand({
      Bucket: DIAGRAMS_BUCKET,
      Key: metadata.s3Key,
    })
    const s3Result = await s3Client.send(getObjectCommand)

    // Read S3 object body
    const architectureJson = await s3Result.Body?.transformToString()
    if (!architectureJson) {
      return errorResponse(500, 'Failed to read diagram data from S3')
    }

    const architecture = JSON.parse(architectureJson)

    logger.info('Diagram retrieved successfully', { diagramId, version })

    return successResponse({
      diagramId: metadata.diagramId,
      version: metadata.version,
      name: metadata.name,
      architecture,
      tags: metadata.tags || [],
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      changeDescription: metadata.changeDescription,
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Get diagram failed', {
      error: err.message,
      errorName: err.name,
    })

    if (err.name === 'NoSuchKey') {
      return errorResponse(404, 'Diagram data not found in storage')
    }

    return errorResponse(500, 'Failed to retrieve diagram')
  }
}
