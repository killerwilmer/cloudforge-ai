/**
 * Custom error classes for CloudForge AI
 */

export class CloudForgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends CloudForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details)
  }
}

export class AuthenticationError extends CloudForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', details)
  }
}

export class AuthorizationError extends CloudForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', details)
  }
}

export class ServiceError extends CloudForgeError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly retryable: boolean = false,
    details?: Record<string, unknown>
  ) {
    super(message, 'SERVICE_ERROR', { ...details, service, retryable })
  }
}

export class DeploymentError extends CloudForgeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'DEPLOYMENT_ERROR', details)
  }
}

export class NotFoundError extends CloudForgeError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', { resource, id })
  }
}
