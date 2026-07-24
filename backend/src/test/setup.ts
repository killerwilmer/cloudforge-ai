/**
 * Jest setup file for backend tests
 * Sets up test environment variables
 */

// Set test environment variables
process.env.AWS_REGION = 'us-east-1'
process.env.DYNAMODB_USERS_TABLE = 'test-users-table'
process.env.DYNAMODB_DIAGRAMS_TABLE = 'test-diagrams-table'
process.env.DYNAMODB_DEPLOYMENTS_TABLE = 'test-deployments-table'
process.env.S3_DIAGRAMS_BUCKET = 'test-diagrams-bucket'
process.env.S3_TEMPLATES_BUCKET = 'test-templates-bucket'
process.env.LOG_LEVEL = 'error' // Reduce noise in tests
process.env.COGNITO_USER_POOL_ID = 'us-east-1_TESTPOOL'
process.env.COGNITO_CLIENT_ID = 'test-client-id'
process.env.BEDROCK_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
process.env.BEDROCK_REGION = 'us-east-1'
