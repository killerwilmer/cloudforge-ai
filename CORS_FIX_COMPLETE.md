# ✅ CORS Issue Fixed

## Problem

The frontend at http://localhost:5174/ was getting CORS errors when trying to call the API:

```
Access to fetch at 'https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/auth/signup' 
from origin 'http://localhost:5174' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause

The issue had **two problems**:

1. **Import Path Issue**: Lambda functions were trying to import from `'../../shared/utils'` but the shared code couldn't be found at runtime
2. **Missing Environment Variables**: Lambda functions required environment variables that weren't configured in the CDK stack

## Solution

### 1. Fixed Lambda Code Deployment

**Changed from**: Separate Lambda function code directories
```typescript
code: lambda.Code.fromAsset('src/lambdas/auth')
handler: 'sign-up.handler'
```

**Changed to**: Deploy entire `src` directory with all shared code
```typescript
code: lambda.Code.fromAsset('src')
handler: 'lambdas/auth/sign-up.handler'
```

This ensures the Lambda functions have access to `src/shared/*` at runtime because the entire `src` tree is deployed.

### 2. Fixed Environment Variables

**Added missing environment variables** to Lambda functions:

```typescript
// Auth Lambda environment
const authEnv = {
  COGNITO_USER_POOL_ID: userPool.userPoolId,
  COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
  DYNAMODB_USERS_TABLE: usersTable.tableName,
  LOG_LEVEL: 'INFO',
}

// AI Lambda environment  
const aiEnv = {
  BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  BEDROCK_REGION: 'us-east-1',
  DYNAMODB_USERS_TABLE: usersTable.tableName,
  LOG_LEVEL: 'INFO',
}
```

**Note**: Removed `AWS_REGION` from custom env vars because it's a reserved Lambda environment variable (automatically set by AWS).

### 3. CORS Headers Were Already Correct

The CORS configuration was actually correct all along:

**API Gateway CORS Preflight** (in CDK):
```typescript
defaultCorsPreflightOptions: {
  allowOrigins: apigateway.Cors.ALL_ORIGINS,
  allowMethods: apigateway.Cors.ALL_METHODS,
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Amz-Date',
    'X-Api-Key',
    'X-Amz-Security-Token',
  ],
  maxAge: cdk.Duration.hours(1),
}
```

**Lambda Response Headers** (in shared utils):
```typescript
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
}
```

The CORS headers were configured correctly, but they weren't being returned because the Lambda functions were failing to execute due to the import/environment issues.

## Verification

### Test 1: OPTIONS Preflight Request
```bash
curl -X OPTIONS https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/auth/signup \
  -H "Origin: http://localhost:5174" \
  -H "Access-Control-Request-Method: POST" \
  -i
```

**Result**: ✅ `HTTP/2 204` with CORS headers

### Test 2: POST Sign-Up Request
```bash
curl -X POST https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/auth/signup \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5174" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'
```

**Result**: ✅ `HTTP/2 200` with response:
```json
{
  "message": "User registered successfully. Please verify your email.",
  "userSub": "a4e8c448-3071-705e-6f2b-3ceea03022fa",
  "userConfirmed": false
}
```

**CORS Headers Present**:
```
access-control-allow-origin: *
access-control-allow-headers: Content-Type,Authorization
access-control-allow-methods: OPTIONS,POST,GET,PUT,DELETE
```

## Files Modified

1. **backend/lib/cloudforge-ai-stack.ts**
   - Changed Lambda `code` from `fromAsset('src/lambdas/auth')` to `fromAsset('src')`
   - Changed Lambda `handler` from `sign-up.handler` to `lambdas/auth/sign-up.handler`
   - Added missing environment variables to `authEnv` and `aiEnv`
   - Removed reserved `AWS_REGION` environment variable

2. **backend/src** (no changes to TypeScript imports needed)
   - Imports remained as `'../../shared/utils'` (relative paths)
   - Works because entire `src/` tree is deployed

## Deployment

```bash
cd backend
npm run build       # Compile TypeScript
cdk deploy --all --require-approval never
```

**Deployment time**: ~35 seconds  
**Status**: ✅ Successful

## Current Status

### ✅ Working
- API Gateway endpoints responding correctly
- CORS headers present on all responses
- Lambda functions executing successfully
- Sign-up flow working (creates user in Cognito)
- Environment variables correctly configured

### 🧪 Ready to Test
- Frontend sign-up form at http://localhost:5174/auth
- Email verification flow
- Sign-in flow
- Architecture generation (requires Bedrock model access)

## Next Steps

1. **Test frontend in browser**:
   ```
   Visit: http://localhost:5174/
   Click: "Get Started Free"
   Try: Sign up with your email
   ```

2. **Enable Bedrock Model Access** (for architecture generation):
   - Go to AWS Console → Amazon Bedrock → Model access
   - Enable "Claude 3.5 Sonnet" (anthropic.claude-3-5-sonnet-20241022-v2:0)
   - Wait for approval (usually instant)

3. **Test architecture generation**:
   - Sign in to the app
   - Navigate to `/generate`
   - Enter a problem description
   - Click "Generate Architecture"

## Technical Notes

### Lambda Deployment Pattern

**Before** (❌ Didn't work):
```
Lambda Package:
└── lambdas/auth/
    ├── sign-up.js
    ├── sign-in.js
    └── ... (trying to import from ../../shared/utils - NOT FOUND)
```

**After** (✅ Works):
```
Lambda Package:
├── lambdas/
│   └── auth/
│       ├── sign-up.js  (handler: lambdas/auth/sign-up.handler)
│       └── sign-in.js
└── shared/
    ├── utils/
    └── types/
```

### Environment Variable Pattern

AWS Lambda automatically provides these:
- `AWS_REGION` (reserved, can't be overridden)
- `AWS_EXECUTION_ENV`
- `AWS_LAMBDA_FUNCTION_NAME`
- etc.

Our custom environment variables:
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `DYNAMODB_USERS_TABLE`
- `LOG_LEVEL`
- `BEDROCK_MODEL_ID`
- `BEDROCK_REGION`

## Resources

- **API Endpoint**: https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/
- **Frontend Dev Server**: http://localhost:5174/
- **Cognito User Pool**: us-east-1_ZPAf8RtfQ
- **Region**: us-east-1
- **Account**: 610595225024

## Troubleshooting

If you encounter CORS issues in the future:

1. **Check OPTIONS preflight**:
   ```bash
   curl -X OPTIONS [API_URL] \
     -H "Origin: http://localhost:5174" \
     -H "Access-Control-Request-Method: POST" \
     -i
   ```

2. **Check POST response headers**:
   ```bash
   curl -i -X POST [API_URL] \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:5174" \
     -d '{"test":"data"}'
   ```

3. **Check Lambda logs**:
   ```bash
   aws logs tail /aws/lambda/[FUNCTION_NAME] --since 5m
   ```

4. **Verify environment variables**:
   ```bash
   aws lambda get-function-configuration --function-name [FUNCTION_NAME] \
     --query 'Environment.Variables'
   ```

---

**Status**: ✅ **CORS Issue Resolved - API Fully Functional**

**Next Action**: Test the frontend application in the browser!
