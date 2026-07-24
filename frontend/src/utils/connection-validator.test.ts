import { describe, expect, it } from 'vitest'
import {
  getConnectionDescription,
  getConnectionProtocol,
  getConnectionType,
  validateConnection,
} from './connection-validator'

describe('connection-validator', () => {
  describe('validateConnection', () => {
    it('should allow valid Lambda to DynamoDB connection', () => {
      const result = validateConnection('Lambda', 'DynamoDB')
      expect(result.allowed).toBe(true)
      expect(result.source).toBe('Lambda')
      expect(result.target).toBe('DynamoDB')
      expect(result.reason).toBeUndefined()
    })

    it('should allow valid API Gateway to Lambda connection', () => {
      const result = validateConnection('API Gateway', 'Lambda')
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('should reject invalid S3 to Cognito connection', () => {
      const result = validateConnection('S3', 'Cognito')
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('S3 cannot directly connect to Cognito')
    })

    it('should reject invalid RDS to S3 connection', () => {
      const result = validateConnection('RDS', 'S3')
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('cannot directly connect')
    })

    it('should allow Lambda to S3 connection', () => {
      const result = validateConnection('Lambda', 'S3')
      expect(result.allowed).toBe(true)
    })

    it('should allow SQS to Lambda connection', () => {
      const result = validateConnection('SQS', 'Lambda')
      expect(result.allowed).toBe(true)
    })

    it('should allow CloudFront to S3 connection', () => {
      const result = validateConnection('CloudFront', 'S3')
      expect(result.allowed).toBe(true)
    })

    it('should allow Cognito to Lambda connection', () => {
      const result = validateConnection('Cognito', 'Lambda')
      expect(result.allowed).toBe(true)
    })

    it('should handle undefined service types gracefully', () => {
      const result = validateConnection('UnknownService', 'Lambda')
      expect(result.allowed).toBe(false)
    })
  })

  describe('getConnectionType', () => {
    it('should return sync for API Gateway to Lambda', () => {
      const type = getConnectionType('API Gateway', 'Lambda')
      expect(type).toBe('sync')
    })

    it('should return sync for Lambda to DynamoDB', () => {
      const type = getConnectionType('Lambda', 'DynamoDB')
      expect(type).toBe('sync')
    })

    it('should return async for Lambda to SNS', () => {
      const type = getConnectionType('Lambda', 'SNS')
      expect(type).toBe('async')
    })

    it('should return async for SQS to Lambda', () => {
      const type = getConnectionType('SQS', 'Lambda')
      expect(type).toBe('async')
    })

    it('should return async for S3 to Lambda', () => {
      const type = getConnectionType('S3', 'Lambda')
      expect(type).toBe('async')
    })

    it('should return async for EventBridge to Lambda', () => {
      const type = getConnectionType('EventBridge', 'Lambda')
      expect(type).toBe('async')
    })

    it('should return sync for CloudFront to S3', () => {
      const type = getConnectionType('CloudFront', 'S3')
      expect(type).toBe('sync')
    })

    it('should return data for unspecified connection types', () => {
      const type = getConnectionType('Cognito', 'SNS')
      expect(type).toBe('data')
    })
  })

  describe('getConnectionDescription', () => {
    it('should return description for API Gateway to Lambda', () => {
      const desc = getConnectionDescription('API Gateway', 'Lambda')
      expect(desc).toContain('API Gateway')
      expect(desc).toContain('Lambda')
    })

    it('should return description for Lambda to DynamoDB', () => {
      const desc = getConnectionDescription('Lambda', 'DynamoDB')
      expect(desc).toContain('Lambda')
      expect(desc).toContain('DynamoDB')
    })

    it('should return description for S3 to CloudFront', () => {
      const desc = getConnectionDescription('S3', 'CloudFront')
      expect(desc).toContain('S3')
      expect(desc).toContain('CloudFront')
    })

    it('should return generic description for unknown connections', () => {
      const desc = getConnectionDescription('UnknownSource', 'UnknownTarget')
      expect(desc).toContain('UnknownSource')
      expect(desc).toContain('UnknownTarget')
    })
  })

  describe('getConnectionProtocol', () => {
    it('should return HTTPS/Invoke for API Gateway to Lambda', () => {
      const protocol = getConnectionProtocol('API Gateway', 'Lambda')
      expect(protocol).toBe('HTTPS/Invoke')
    })

    it('should return AWS SDK for Lambda to DynamoDB', () => {
      const protocol = getConnectionProtocol('Lambda', 'DynamoDB')
      expect(protocol).toBe('AWS SDK')
    })

    it('should return TCP/SQL for Lambda to RDS', () => {
      const protocol = getConnectionProtocol('Lambda', 'RDS')
      expect(protocol).toBe('TCP/SQL')
    })

    it('should return HTTPS for CloudFront to S3', () => {
      const protocol = getConnectionProtocol('CloudFront', 'S3')
      expect(protocol).toBe('HTTPS')
    })

    it('should return AWS for unknown connections', () => {
      const protocol = getConnectionProtocol('Unknown', 'Service')
      expect(protocol).toBe('AWS')
    })
  })
})
