import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
  errorResponse,
  logger,
  successResponse,
} from '../../shared/utils'

// Initialize AWS clients outside handler for reuse
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
)

const DIAGRAMS_TABLE = process.env.DYNAMODB_DIAGRAMS_TABLE!

/**
 * List diagrams handler
 * Returns all diagrams for the authenticated user
 * GET /api/diagrams?limit={limit}&lastKey={lastKey}
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId
  logger.setContext({ requestId })

  try {
    logger.info('List diagrams request received')

    // Extract userId from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub
    if (!userId) {
      return errorResponse(401, 'User not authenticated')
    }

    // Get pagination parameters
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10)
    const lastKey = event.queryStringParameters?.lastKey
      ? JSON.parse(decodeURIComponent(event.queryStringParameters.lastKey))
      : undefined

    if (limit < 1 || limit > 100) {
      return errorResponse(400, 'Limit must be between 1 and 100')
    }

    // Query diagrams by userId using GSI
    logger.info('Querying diagrams by userId', { userId, limit })
    const queryCommand = new QueryCommand({
      TableName: DIAGRAMS_TABLE,
      IndexName: 'UserDiagramsIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':versionZero': 0, // Only get latest version pointers
      },
      FilterExpression: 'version = :versionZero', // Filter to only version 0 (latest pointers)
      ScanIndexForward: false, // Sort by updatedAt descending (newest first)
      Limit: limit,
      ExclusiveStartKey: lastKey,
    })

    const result = await dynamoClient.send(queryCommand)

    const diagrams = (result.Items || []).map((item) => ({
      diagramId: item.diagramId,
      name: item.name,
      latestVersion: item.latestVersion || 1,
      tags: item.tags || [],
      updatedAt: item.updatedAt,
      servicesCount: item.servicesCount,
      connectionsCount: item.connectionsCount,
    }))

    logger.info('Diagrams retrieved successfully', { count: diagrams.length })

    return successResponse({
      diagrams,
      count: diagrams.length,
      lastKey: result.LastEvaluatedKey
        ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
        : undefined,
    })
  } catch (error: unknown) {
    const err = error as Error

    logger.error('List diagrams failed', {
      error: err.message,
      errorName: err.name,
    })

    return errorResponse(500, 'Failed to list diagrams')
  }
}
