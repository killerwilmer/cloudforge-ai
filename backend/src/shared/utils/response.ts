/**
 * Standardized API Gateway response helpers
 */

import { APIGatewayProxyResult } from 'aws-lambda'

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
}

export function successResponse(
  data: unknown,
  statusCode: number = 200
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(data),
  }
}

export function errorResponse(
  statusCode: number,
  message: string,
  details?: Record<string, unknown>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      error: {
        message,
        ...details,
      },
    }),
  }
}

export function validationErrorResponse(
  errors: Array<{ field: string; message: string }>
): APIGatewayProxyResult {
  return errorResponse(400, 'Validation failed', { errors })
}

export function unauthorizedResponse(
  message: string = 'Unauthorized'
): APIGatewayProxyResult {
  return errorResponse(401, message)
}

export function forbiddenResponse(
  message: string = 'Forbidden'
): APIGatewayProxyResult {
  return errorResponse(403, message)
}

export function notFoundResponse(
  resource: string,
  id: string
): APIGatewayProxyResult {
  return errorResponse(404, `${resource} not found`, { id })
}

export function internalErrorResponse(
  errorId: string,
  message: string = 'An unexpected error occurred'
): APIGatewayProxyResult {
  return errorResponse(500, message, { errorId })
}
