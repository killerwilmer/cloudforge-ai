/**
 * Structured logging utility for Lambda functions
 * Never logs PII or tokens (security requirement)
 */

export interface LogContext {
  requestId?: string
  userId?: string
  [key: string]: unknown
}

class Logger {
  private context: LogContext = {}

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context }
  }

  clearContext(): void {
    this.context = {}
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        level: 'INFO',
        message,
        timestamp: new Date().toISOString(),
        ...this.context,
        ...meta,
      })
    )
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        message,
        timestamp: new Date().toISOString(),
        ...this.context,
        ...meta,
      })
    )
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        message,
        timestamp: new Date().toISOString(),
        ...this.context,
        ...meta,
      })
    )
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(
        JSON.stringify({
          level: 'DEBUG',
          message,
          timestamp: new Date().toISOString(),
          ...this.context,
          ...meta,
        })
      )
    }
  }
}

export const logger = new Logger()
