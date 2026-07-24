/**
 * Tests for logger utility
 * Demonstrates testing patterns for backend utilities
 */

import { logger } from './logger'

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    logger.clearContext()
  })

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('info', () => {
    it('should log info messages with structured JSON', () => {
      logger.info('Test message', { key: 'value' })

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0])

      expect(loggedData).toMatchObject({
        level: 'INFO',
        message: 'Test message',
        key: 'value',
      })
      expect(loggedData.timestamp).toBeDefined()
    })

    it('should include context in logs', () => {
      logger.setContext({ requestId: 'req-123', userId: 'user-456' })
      logger.info('Test with context')

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(loggedData).toMatchObject({
        requestId: 'req-123',
        userId: 'user-456',
        message: 'Test with context',
      })
    })
  })

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Error occurred', { errorCode: 500 })

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0])

      expect(loggedData).toMatchObject({
        level: 'ERROR',
        message: 'Error occurred',
        errorCode: 500,
      })
    })
  })

  describe('context management', () => {
    it('should set and clear context', () => {
      logger.setContext({ sessionId: 'session-123' })
      logger.info('Message 1')

      logger.clearContext()
      logger.info('Message 2')

      const log1 = JSON.parse(consoleLogSpy.mock.calls[0][0])
      const log2 = JSON.parse(consoleLogSpy.mock.calls[1][0])

      expect(log1.sessionId).toBe('session-123')
      expect(log2.sessionId).toBeUndefined()
    })

    it('should merge multiple context sets', () => {
      logger.setContext({ key1: 'value1' })
      logger.setContext({ key2: 'value2' })
      logger.info('Test')

      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(loggedData).toMatchObject({
        key1: 'value1',
        key2: 'value2',
      })
    })
  })
})
