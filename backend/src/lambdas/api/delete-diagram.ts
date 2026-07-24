import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
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
 * Delete diagram handler
 * Deletes diagram and all its versions
 * DELETE /api/diagrams/{diagramId}
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('Delete diagram request received')

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

    // Verify ownership by checking version 0 record
    logger.info('Verifying diagram ownership', { diagramId })
    const getCommand = new GetCommand({
      TableName: DIAGRAMS_TABLE,
      Key: { diagramId, version: 0 },
    })
    const result = await dynamoClient.send(getCommand)

    if (!result.Item) {
      return errorResponse(404, 'Diagram not found')
    }

    if (result.Item.userId !== userId) {
      return errorResponse(403, 'Access denied')
    }

    // Get all versions for this diagram
    logger.info('Fetching all versions for deletion', { diagramId })
    const queryCommand = new QueryCommand({
      TableName: DIAGRAMS_TABLE,
      KeyConditionExpression: 'diagramId = :diagramId',
      ExpressionAttributeValues: {
        ':diagramId': diagramId,
      },
    })
    const versionsResult = await dynamoClient.send(queryCommand)
    const versions = versionsResult.Items || []

    // Delete all versions from DynamoDB
    logger.info('Deleting diagram versions from DynamoDB', {
      count: versions.length,
    })
    await Promise.all(
      versions.map((item) =>
        dynamoClient.send(
          new DeleteCommand({
            TableName: DIAGRAMS_TABLE,
            Key: {
              diagramId: item.diagramId,
              version: item.version,
            },
          })
        )
      )
    )

    // Delete all S3 objects for this diagram
    logger.info('Deleting diagram files from S3', { diagramId })
    const s3Prefix = `diagrams/${userId}/${diagramId}/`
    const listCommand = new ListObjectsV2Command({
      Bucket: DIAGRAMS_BUCKET,
      Prefix: s3Prefix,
    })
    const s3Objects = await s3Client.send(listCommand)

    if (s3Objects.Contents && s3Objects.Contents.length > 0) {
      await Promise.all(
        s3Objects.Contents.map((obj) =>
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: DIAGRAMS_BUCKET,
              Key: obj.Key!,
            })
          )
        )
      )
      logger.info('S3 files deleted', { count: s3Objects.Contents.length })
    }

    logger.info('Diagram deleted successfully', { diagramId })

    return successResponse({
      message: 'Diagram deleted successfully',
      diagramId,
      versionsDeleted: versions.length,
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('Delete diagram failed', {
      error: err.message,
      errorName: err.name,
    })

    return errorResponse(500, 'Failed to delete diagram')
  }
}
