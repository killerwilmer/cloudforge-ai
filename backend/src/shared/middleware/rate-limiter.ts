import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || 'CloudForgeAI-RateLimits';
const BEDROCK_DAILY_LIMIT = 20;

interface RateLimitRecord {
  userId: string;
  date: string;
  count: number;
  expiresAt: number;
}

/**
 * Check if user has exceeded daily Bedrock API rate limit
 * @param userId - User's Cognito ID
 * @returns Object with allowed status and remaining calls
 */
export async function checkBedrockRateLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const recordKey = `${userId}#${today}`;

  try {
    // Get current usage for today
    const result = await docClient.send(
      new GetCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { userId: recordKey },
      })
    );

    const currentCount = (result.Item?.count as number) || 0;
    const remaining = Math.max(0, BEDROCK_DAILY_LIMIT - currentCount);
    const allowed = currentCount < BEDROCK_DAILY_LIMIT;

    // Calculate reset time (midnight UTC)
    const resetAt = new Date(today);
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);
    resetAt.setUTCHours(0, 0, 0, 0);

    return {
      allowed,
      remaining,
      limit: BEDROCK_DAILY_LIMIT,
      resetAt,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // On error, allow the request but log the issue
    return {
      allowed: true,
      remaining: BEDROCK_DAILY_LIMIT,
      limit: BEDROCK_DAILY_LIMIT,
      resetAt: new Date(),
    };
  }
}

/**
 * Increment user's Bedrock API usage counter
 * @param userId - User's Cognito ID
 */
export async function incrementBedrockUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const recordKey = `${userId}#${today}`;

  // Set expiration to 2 days from now (cleanup old records)
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 2;

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { userId: recordKey },
        UpdateExpression:
          'SET #count = if_not_exists(#count, :zero) + :inc, #date = :date, expiresAt = :exp',
        ExpressionAttributeNames: {
          '#count': 'count',
          '#date': 'date',
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': 1,
          ':date': today,
          ':exp': expiresAt,
        },
      })
    );
  } catch (error) {
    console.error('Error incrementing rate limit:', error);
    // Don't throw - allow the request to proceed even if tracking fails
  }
}

/**
 * Get user's current usage stats
 * @param userId - User's Cognito ID
 */
export async function getBedrockUsageStats(userId: string): Promise<{
  used: number;
  remaining: number;
  limit: number;
  resetAt: Date;
}> {
  const { allowed, remaining, limit, resetAt } = await checkBedrockRateLimit(userId);
  const used = limit - remaining;

  return {
    used,
    remaining,
    limit,
    resetAt,
  };
}
