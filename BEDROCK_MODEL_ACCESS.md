# AWS Bedrock Model Access Setup

## Current Status (Updated)

✅ **Authentication working** - Cognito authorizer accepting ID tokens  
✅ **API Gateway configured** - CORS working with Cognito  
✅ **Lambda function deployed** - Ready to generate architectures  
✅ **Model auto-activation enabled** - Models activate on first use  
⚠️ **First invocation needed** - Need to trigger model activation

## Issue

AWS Bedrock models now **auto-activate on first invocation**. No manual model access request needed!

However:
- Claude 3 models are marked as `LEGACY` (disabled after 30 days of inactivity)
- Newer models auto-activate when first invoked
- Anthropic models (Claude 4+) may require use case submission for first-time users

## Solution: Test in Browser (Auto-Activates Model)

### Quick Test

1. **Open the app**: http://localhost:5173/
2. **Sign in** with: `killerwilmer@gmail.com` / `Skynet2049@?`
3. **Navigate to**: `/generate`
4. **Enter description**: "I need a serverless REST API to manage user tasks"
5. **Click "Generate Architecture"**

This will trigger the first invocation and auto-activate Amazon Nova 2 Lite.

### Expected Outcomes

**✅ Success** - Model activates and generates architecture  
**⚠️ Use Case Required** - Anthropic models may need use case submission (see below)  
**❌ Access Denied** - Legacy model disabled (need to switch models)

### If Use Case Submission Required

For Claude 4+ models, AWS may require use case details:

1. Go to: https://console.aws.amazon.com/bedrock/
2. Click "Model catalog" → Find "Claude Sonnet 4"
3. Click "Request access" or "Submit use case"
4. Fill in:
   - **Use case**: "AWS architecture generation for educational hackathon"
   - **Industry**: Technology
   - **Data types**: Architecture diagrams, AWS service configurations
5. Submit and wait for approval (usually instant)

## Alternative: Test in Bedrock Playground

1. Go to: https://console.aws.amazon.com/bedrock/
2. Click "Playgrounds" → "Text"
3. Select model: **Amazon Nova 2 Lite**
4. Type: "Generate a simple AWS architecture"
5. Click "Run"

This will activate the model for your account.

## Recommended Models (in order of cost)

| Model | Cost | Quality | Speed |
|-------|------|---------|-------|
| Amazon Nova Lite | $ | Good | Fast |
| Amazon Nova Pro | $$ | Better | Medium |
| Claude Sonnet 4 | $$$ | Best | Medium |

## Testing After Model Access

Once model access is approved:

```bash
# Test via browser
open http://localhost:5173/

# Or test via CLI
cd backend
npm run test:generate-arch

# Or test via curl
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 44pnpbu7e2q779dm86bb4ac3tb \
  --auth-parameters USERNAME=killerwilmer@gmail.com,PASSWORD='Skynet2049@?' \
  --region us-east-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text)

curl -X POST https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/api/architectures/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"description":"I need a serverless REST API to manage user tasks with authentication and persistent storage"}'
```

## What's Working Now

1. ✅ User sign-up with Cognito
2. ✅ User sign-in with email/password
3. ✅ Token storage in browser localStorage
4. ✅ Protected API endpoint with Cognito authorizer
5. ✅ CORS configured for auth errors
6. ✅ Lambda function ready to invoke Bedrock
7. ✅ Frontend UI for architecture generation
8. ❌ **Bedrock model access** ← ONLY BLOCKER

## Alternative: Use Cross-Region Inference

If you have model access in another region:

```typescript
// In cloudforge-ai-stack.ts
const aiEnv = {
  BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
  BEDROCK_REGION: 'us-west-2', // Change region
  // ...
}
```

Then update the IAM policy ARN to match the new region.
