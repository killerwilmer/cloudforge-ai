import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import {
    checkBedrockRateLimit,
    getBedrockUsageStats,
    incrementBedrockUsage,
} from '../shared/middleware/rate-limiter';

// Mock DynamoDB Document Client
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Rate Limiter', () => {
  beforeEach(() => {
    ddbMock.reset();
    jest.clearAllMocks();
  });

  describe('checkBedrockRateLimit', () => {
    it('should allow request when user has no usage', async () => {
      // Mock DynamoDB returning no record (first request of the day)
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const result = await checkBedrockRateLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20);
      expect(result.limit).toBe(20);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should allow request when user has usage below limit', async () => {
      // Mock DynamoDB returning existing usage (5 requests)
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 5,
          date: '2026-07-26',
        },
      });

      const result = await checkBedrockRateLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(15);
      expect(result.limit).toBe(20);
    });

    it('should deny request when user has reached limit', async () => {
      // Mock DynamoDB returning usage at limit (20 requests)
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 20,
          date: '2026-07-26',
        },
      });

      const result = await checkBedrockRateLimit('user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(20);
    });

    it('should deny request when user has exceeded limit', async () => {
      // Mock DynamoDB returning usage above limit (25 requests)
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 25,
          date: '2026-07-26',
        },
      });

      const result = await checkBedrockRateLimit('user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.limit).toBe(20);
    });

    it('should allow request on DynamoDB error (fail open)', async () => {
      // Mock DynamoDB throwing error
      ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      const result = await checkBedrockRateLimit('user-123');

      // Should fail open and allow the request
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20);
    });

    it('should return correct reset time (next day at midnight UTC)', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 10,
          date: '2026-07-26',
        },
      });

      const result = await checkBedrockRateLimit('user-123');

      // Reset time should be next day at 00:00:00 UTC
      expect(result.resetAt.getUTCHours()).toBe(0);
      expect(result.resetAt.getUTCMinutes()).toBe(0);
      expect(result.resetAt.getUTCSeconds()).toBe(0);
    });
  });

  describe('incrementBedrockUsage', () => {
    it('should increment usage counter for first request', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await incrementBedrockUsage('user-123');

      // Verify UpdateCommand was called
      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls.length).toBe(1);

      const updateCall = calls[0].args[0].input;
      expect(updateCall.Key).toMatchObject({
        userId: expect.stringMatching(/^user-123#\d{4}-\d{2}-\d{2}$/),
      });
      expect(updateCall.UpdateExpression).toContain('if_not_exists(#count, :zero) + :inc');
    });

    it('should increment usage counter for existing record', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await incrementBedrockUsage('user-456');

      const calls = ddbMock.commandCalls(UpdateCommand);
      expect(calls.length).toBe(1);
    });

    it('should not throw on DynamoDB error', async () => {
      // Mock DynamoDB throwing error
      ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));

      // Should not throw - allows request to proceed
      await expect(incrementBedrockUsage('user-123')).resolves.not.toThrow();
    });

    it('should set TTL for record cleanup', async () => {
      ddbMock.on(UpdateCommand).resolves({});

      await incrementBedrockUsage('user-123');

      const calls = ddbMock.commandCalls(UpdateCommand);
      const updateCall = calls[0].args[0].input;

      // Should set expiresAt for TTL (2 days from now)
      expect(updateCall.ExpressionAttributeValues).toHaveProperty(':exp');
      expect(updateCall.ExpressionAttributeValues?.[':exp']).toBeGreaterThan(
        Math.floor(Date.now() / 1000)
      );
    });
  });

  describe('getBedrockUsageStats', () => {
    it('should return correct usage stats', async () => {
      // Mock 15 requests used
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 15,
          date: '2026-07-26',
        },
      });

      const stats = await getBedrockUsageStats('user-123');

      expect(stats.used).toBe(15);
      expect(stats.remaining).toBe(5);
      expect(stats.limit).toBe(20);
      expect(stats.resetAt).toBeInstanceOf(Date);
    });

    it('should return zero usage for new user', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      const stats = await getBedrockUsageStats('user-123');

      expect(stats.used).toBe(0);
      expect(stats.remaining).toBe(20);
      expect(stats.limit).toBe(20);
    });

    it('should return stats when at limit', async () => {
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 20,
          date: '2026-07-26',
        },
      });

      const stats = await getBedrockUsageStats('user-123');

      expect(stats.used).toBe(20);
      expect(stats.remaining).toBe(0);
      expect(stats.limit).toBe(20);
    });
  });

  describe('Rate Limiting Flow', () => {
    it('should allow 20 requests then block the 21st', async () => {
      // Simulate 19 requests
      for (let i = 1; i < 20; i++) {
        ddbMock.on(GetCommand).resolves({
          Item: {
            userId: `user-123#2026-07-26`,
            count: i,
            date: '2026-07-26',
          },
        });

        const result = await checkBedrockRateLimit('user-123');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(20 - i);
      }

      // 20th request - should still be allowed
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 19,
          date: '2026-07-26',
        },
      });

      let result = await checkBedrockRateLimit('user-123');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);

      // 21st request - should be blocked
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-123#2026-07-26',
          count: 20,
          date: '2026-07-26',
        },
      });

      result = await checkBedrockRateLimit('user-123');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset count on new day', async () => {
      // Yesterday's usage (at limit) - will not be found because we check today's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Mock: no record found for today (new day)
      ddbMock.on(GetCommand).resolves({
        Item: undefined,
      });

      // Today should be a new record with zero count
      const result = await checkBedrockRateLimit('user-123');

      // Should be checking for today's date, so no record found = allowed
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20);
    });
  });

  describe('Multiple Users', () => {
    it('should track usage independently per user', async () => {
      // Mock returns different results - last one wins for the specific key
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-2#2026-07-26',
          count: 2,
          date: '2026-07-26',
        },
      });

      const user2Result = await checkBedrockRateLimit('user-2');
      expect(user2Result.remaining).toBe(18);

      // Reset and set for user 1
      ddbMock.reset();
      ddbMock.on(GetCommand).resolves({
        Item: {
          userId: 'user-1#2026-07-26',
          count: 18,
          date: '2026-07-26',
        },
      });

      const user1Result = await checkBedrockRateLimit('user-1');
      expect(user1Result.remaining).toBe(2);
    });
  });
});
