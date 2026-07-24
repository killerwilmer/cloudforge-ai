# 🚨 MANUAL MODEL SETUP REQUIRED

## Current Status

✅ **Full application deployed and working**  
✅ **Authentication with Cognito**  
✅ **Protected API endpoints**  
✅ **Frontend UI ready**  
❌ **Model subscription required** - Need AWS Console access with Marketplace permissions

## The Issue

AWS Bedrock inference profiles require an AWS Marketplace subscription to be activated by an IAM user with marketplace permissions. The Lambda function has the right permissions, but the initial subscription must be done manually by a user.

## Solution: Manual Marketplace Subscription

### Step 1: Login to AWS Console

1. Go to: https://console.aws.amazon.com/bedrock/
2. Ensure you're in region: **us-east-1**
3. Use an IAM user/role with these permissions:
   - `aws-marketplace:ViewSubscriptions`
   - `aws-marketplace:Subscribe`
   - `bedrock:InvokeModel`

### Step 2: Activate Model in Playground

1. Click **"Playgrounds"** in the left sidebar
2. Click **"Text"** playground
3. In the model selector dropdown, choose:
   - **Claude 3 Haiku** (recommended - cheap & fast)
   - Or **Claude 3 Sonnet** (better quality)
4. Type any message: "Hello, test message"
5. Click **"Run"**

This will:
- Automatically subscribe to the model via AWS Marketplace
- Activate the inference profile for your account
- Enable Lambda functions to use the model

### Step 3: Update Model ID (if needed)

If you used Claude 3 Haiku (recommended):

```bash
# No changes needed! Already configured
```

If you used Claude 3 Sonnet:

```bash
cd backend
# Edit lib/cloudforge-ai-stack.ts
# Change line ~269 to:
# BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-sonnet-20240229-v1:0',

cdk deploy --all --require-approval never
```

### Step 4: Test

Once the model is activated:

```bash
# Test via browser
open http://localhost:5173/

# Sign in with: killerwilmer@gmail.com / Skynet2049@?
# Navigate to /generate
# Enter a description and click "Generate Architecture"
```

Or test via CLI:

```bash
ID_TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id 44pnpbu7e2q779dm86bb4ac3tb \
  --auth-parameters USERNAME=killerwilmer@gmail.com,PASSWORD='Skynet2049@?' \
  --region us-east-1 \
  --query 'AuthenticationResult.IdToken' \
  --output text)

curl -s -X POST https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/api/architectures/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"description":"I need a serverless REST API to manage user tasks with authentication"}' | jq '.'
```

## Why This Happens

- AWS Bedrock models served through inference profiles require AWS Marketplace subscription
- Subscriptions must be initiated by an IAM user/role with marketplace permissions
- Lambda functions can't initiate subscriptions autonomously
- After first subscription, the model works for all services in the account

## Model Options (After Subscription)

| Model | ID | Cost | Quality |
|-------|-----|------|---------|
| Claude 3 Haiku | `us.anthropic.claude-3-haiku-20240307-v1:0` | $ | Good |
| Claude 3 Sonnet | `us.anthropic.claude-3-sonnet-20240229-v1:0` | $$ | Better |

## Alternative: Use Direct Model IDs (Not Recommended)

If you have access to non-legacy direct model IDs (not inference profiles), you could try:

```bash
# Check available models
aws bedrock list-foundation-models --region us-east-1 \
  --query 'modelSummaries[?modelLifecycle.status==`ACTIVE`].[modelId,modelName,providerName]' \
  --output table
```

But most are either:
- Marked as LEGACY (disabled after 30 days)
- Require inference profiles (need marketplace subscription)
- Are image/embedding models (not text generation)

## What's Already Working

1. ✅ User authentication (Cognito)
2. ✅ Token management (localStorage)
3. ✅ Protected APIs (Cognito authorizer)
4. ✅ CORS configured properly
5. ✅ Lambda with all required permissions
6. ✅ Frontend UI for architecture generation
7. ✅ DynamoDB tables created
8. ✅ S3 buckets for diagrams/templates
9. ❌ **Model subscription** ← ONLY BLOCKER

## Next Steps

1. Complete the manual marketplace subscription (Steps 1-2 above)
2. Test in browser or via CLI (Step 4)
3. Continue with hackathon tasks!

## Support

If you encounter issues:
- Check IAM user has marketplace permissions
- Ensure you're in us-east-1 region
- Wait 2 minutes after activation for propagation
- Check Lambda logs: `aws logs tail /aws/lambda/CloudForgeAIStack-GenerateArchitectureFunction4D3F-f5TpPDZzrjNm --region us-east-1 --since 1m`
