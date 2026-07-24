/**
 * Tests for validation utilities
 * Demonstrates unit testing and property-based testing patterns
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { isValidEmail, isValidServiceName, isValidRegion } from './validation'

describe('validation utilities', () => {
  describe('isValidEmail', () => {
    it('should accept valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('test.user@subdomain.example.com')).toBe(true)
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true)
    })

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('notanemail')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user @example.com')).toBe(false)
    })

    // Property-based test: all valid emails must contain @ and .
    it('should always require @ and . in email', () => {
      fc.assert(
        fc.property(fc.emailAddress(), email => {
          if (isValidEmail(email)) {
            expect(email).toContain('@')
            expect(email).toContain('.')
          }
        })
      )
    })
  })

  describe('isValidServiceName', () => {
    it('should accept valid service names', () => {
      expect(isValidServiceName('api')).toBe(true)
      expect(isValidServiceName('api-gateway')).toBe(true)
      expect(isValidServiceName('MyService123')).toBe(true)
      expect(isValidServiceName('a')).toBe(true)
    })

    it('should reject invalid service names', () => {
      expect(isValidServiceName('')).toBe(false)
      expect(isValidServiceName('-api')).toBe(false) // Cannot start with hyphen
      expect(isValidServiceName('api-')).toBe(false) // Cannot end with hyphen
      expect(isValidServiceName('api service')).toBe(false) // No spaces
      expect(isValidServiceName('api_service')).toBe(false) // No underscores
      expect(isValidServiceName('a'.repeat(65))).toBe(false) // Too long
    })

    it('should enforce length limits', () => {
      expect(isValidServiceName('a'.repeat(64))).toBe(true)
      expect(isValidServiceName('a'.repeat(65))).toBe(false)
    })
  })

  describe('isValidRegion', () => {
    it('should accept valid AWS regions', () => {
      expect(isValidRegion('us-east-1')).toBe(true)
      expect(isValidRegion('eu-west-1')).toBe(true)
      expect(isValidRegion('ap-southeast-1')).toBe(true)
    })

    it('should reject invalid regions', () => {
      expect(isValidRegion('')).toBe(false)
      expect(isValidRegion('invalid')).toBe(false)
      expect(isValidRegion('us-east-3')).toBe(false) // Doesn't exist
    })
  })
})
