# API Gateway Configuration

This document describes the API Gateway setup for CloudForge AI.

## Overview

CloudForge AI uses AWS API Gateway REST API with the following configuration:

- **API Type**: REST API (for full feature support including usage plans)
- **Stage**: `prod`
- **Authentication**: AWS Cognito User Pools Authorizer
- **Rate Limiting**: 100 requests/minute per user
- **CORS**: Enabled for cross-origin requests

## Rate Limiting

### Usage Plan Configuration

- **Rate Limit**: 100 requests/second per user
- **Burst Limit**: 200 concurrent requests
- **Daily Quota**: 10,000 requests per day

### Throttling

- **API-level throttling**: 100 req/sec (rate limit), 200 burst
- **Method-level throttling**: Can be configured per endpoint

## CORS Configuration

CORS is enabled with the following settings:

```typescript
allowOrigins: ALL_ORIGINS  // TODO: Restrict to production domain
allowMethods: ALL_METHODS
allowHeaders: [
  'Content-Type',
  'Authorization',
  'X-Amz-Date',
  'X-Api-Key',
  'X-Amz-Security-Token'
]
maxAge: 1 hour
```

## Authentication

### Cognito Authorizer

- **Type**: Cognito User Pools Authorizer
- **Identity Source**: `Authorization` header
- **Token Type**: JWT (Bearer token)

### Protected Routes

Routes that require authentication should use the authorizer:

```typescript
resource.addMethod('GET', integration, {
  authorizer: authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
})
```

### Public Routes

Auth endpoints are public (no authorization required):

- `POST /auth/signup` - User registration
- `POST /auth/signin` - User login
- `POST /auth/signout` - User logout
- `POST /auth/refresh` - Token refresh

## Logging & Monitoring

### CloudWatch Logs

- **Logging Level**: INFO
- **Data Trace**: Disabled (to prevent PII logging)
- **Metrics**: Enabled

### Monitored Metrics

- Request count
- Latency (avg, p50, p90, p99)
- Error rate (4xx, 5xx)
- Throttling events

## Lambda Layer

### Shared Layer Contents

The shared Lambda layer includes:

- **Utilities**: Logger, error handlers, response helpers, config loaders
- **AWS SDK Clients**:
  - Cognito Identity Provider
  - DynamoDB & DynamoDB Document Client
  - S3
  - Secrets Manager
  - Bedrock Runtime
  - CloudFormation
  - STS
  - Pricing

### Building the Layer

```bash
npm run build:layer
```

This creates a properly structured Lambda layer at `layer/nodejs/` with:
- Shared utilities (`layer/nodejs/shared/`)
- AWS SDK dependencies (`layer/nodejs/node_modules/`)

### Using the Layer

All Lambda functions should include the shared layer:

```typescript
const myFunction = new lambda.Function(this, 'MyFunction', {
  // ... other config
  layers: [sharedLayer],
})
```

## API Endpoints

### Authentication Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| POST | `/auth/signup` | No | Register new user |
| POST | `/auth/signin` | No | Authenticate user |
| POST | `/auth/signout` | No | Sign out user |
| POST | `/auth/refresh` | No | Refresh access token |

### Protected Endpoints (Future Tasks)

These will be added in later tasks and will require authentication:

- `/api/architectures/*` - Architecture generation
- `/api/diagrams/*` - Diagram management
- `/api/deployments/*` - Deployment operations

## Security Best Practices

1. **No PII in Logs**: Data trace is disabled to prevent logging request/response bodies
2. **HTTPS Only**: API Gateway enforces HTTPS
3. **CORS Restrictions**: Should be limited to production domain in prod environment
4. **Rate Limiting**: Prevents abuse with per-user quotas
5. **JWT Validation**: Cognito authorizer validates token signatures
6. **Token Expiration**: Access tokens expire after 24 hours

## Deployment

```bash
# Build the Lambda layer
npm run build:layer

# Synthesize CloudFormation template
npm run cdk:synth

# Deploy to AWS
npm run cdk:deploy
```

## Testing

The API Gateway configuration is tested through:

1. **Unit Tests**: Lambda function tests verify correct responses
2. **Integration Tests**: (TODO) End-to-end API tests
3. **Load Tests**: (TODO) Rate limiting and throttling verification

## Troubleshooting

### Common Issues

**Issue**: Lambda function can't import shared utilities

**Solution**: Ensure the layer is built (`npm run build:layer`) and the Lambda includes the layer in its configuration.

**Issue**: CORS errors in browser

**Solution**: Verify CORS is enabled in API Gateway and frontend is sending correct headers.

**Issue**: 429 Too Many Requests

**Solution**: User has exceeded rate limit (100 req/min). Implement exponential backoff in client.

**Issue**: 401 Unauthorized on protected routes

**Solution**: Ensure `Authorization: Bearer <token>` header is included with valid JWT token.

## Future Enhancements

- [ ] Custom domain name with SSL certificate
- [ ] API versioning (`/v1/`, `/v2/`)
- [ ] Request/response transformations
- [ ] API Gateway caching
- [ ] WAF integration for DDoS protection
- [ ] Per-endpoint rate limiting
- [ ] API key rotation automation
