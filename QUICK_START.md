# Quick Start Guide - CloudForge AI

## Prerequisites Check

Before starting, ensure you have:

- ✅ **AWS Account** with admin access
- ✅ **AWS CLI** installed and configured (`aws --version`)
- ✅ **Node.js 20+** installed (`node --version`)
- ✅ **Amazon Bedrock access** to Claude 3.5 Sonnet

### Enable Bedrock Model Access

1. Go to AWS Console → Amazon Bedrock → Model access
2. Click "Enable specific models"
3. Enable "Claude 3.5 Sonnet v2" (anthropic.claude-3-5-sonnet-20241022-v2:0)
4. Wait for "Access granted" status (~instant)

## Step 1: Verify AWS Credentials

```bash
# Check your AWS identity
aws sts get-caller-identity

# Should output your AWS account ID and user/role
```

## Step 2: Install Dependencies

```bash
# From project root
cd /Users/wilmerarteaga/me/cofacilito/aws/hackathon

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## Step 3: Build Lambda Layer

```bash
cd backend
npm run build:layer
```

Expected output: `Layer built successfully (size: ~33MB)`

## Step 4: Bootstrap CDK (First Time Only)

```bash
cd backend
npm run cdk:bootstrap
```

This creates the CDKToolkit stack in your AWS account.

## Step 5: Deploy Backend to AWS

```bash
cd backend
npm run cdk:deploy
```

**⏱️ This takes ~5-10 minutes**

Watch for these important outputs:
```
Outputs:
CloudForgeAIStack.UserPoolId = us-east-1_XXXXXXXXX
CloudForgeAIStack.UserPoolClientId = abcdefghijklmnopqrstuvwxyz
CloudForgeAIStack.APIEndpoint = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
```

**💾 SAVE THESE VALUES!** You'll need them in the next step.

## Step 6: Configure Frontend

```bash
cd frontend

# Copy example env file
cp .env.example .env.local

# Edit .env.local with your CDK outputs
```

Update `.env.local` with values from Step 5:

```env
# API Configuration
VITE_API_BASE_URL=https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod

# AWS Configuration
VITE_AWS_REGION=us-east-1

# Cognito Configuration (from CDK outputs)
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=abcdefghijklmnopqrstuvwxyz

# Feature Flags
VITE_ENABLE_GITHUB_IMPORT=false
VITE_ENABLE_COST_OPTIMIZATION=true
VITE_ENABLE_SECURITY_REVIEW=true
```

## Step 7: Start Frontend Dev Server

```bash
cd frontend
npm run dev
```

Frontend will be available at: **http://localhost:5173**

## Step 8: Test the Application

### 1. Sign Up

1. Open http://localhost:5173
2. Click "Sign Up"
3. Enter email, name, password
4. Check email for verification code
5. Verify email

### 2. Sign In

1. Enter email and password
2. Should redirect to main app

### 3. Generate Architecture

1. Navigate to "Generate Architecture" page
2. Enter a problem description:
   ```
   I need a serverless REST API for a todo list app. 
   Users should be able to create, read, update, and delete todos. 
   Include authentication and persistent storage.
   ```
3. Click "Generate Architecture"
4. Wait 5-10 seconds for AI to generate
5. Should see architecture with services, connections, and stats

## Troubleshooting

### CDK Deploy Fails

**Error:** `Need to perform AWS calls for account XXX, but no credentials configured`

**Solution:**
```bash
aws configure
# Enter AWS Access Key ID, Secret Access Key, region (us-east-1)
```

---

**Error:** `ResourceConflictException: Stack already exists`

**Solution:**
```bash
# Destroy existing stack first
cd backend
npm run cdk:destroy
# Then deploy again
npm run cdk:deploy
```

---

**Error:** `AccessDeniedException: Cross-account pass role is not allowed`

**Solution:** Ensure your AWS user has permissions for:
- CloudFormation
- Lambda
- API Gateway
- Cognito
- DynamoDB
- S3
- IAM (role creation)

### Bedrock Access Denied

**Error:** `AccessDeniedException: Could not resolve the foundation model`

**Solution:**
1. Go to AWS Console → Bedrock → Model access
2. Request access to Claude 3.5 Sonnet
3. Wait for approval (~instant)
4. Redeploy: `npm run cdk:deploy`

### Frontend Can't Connect

**Error:** `Failed to fetch` or CORS errors in browser console

**Solution:**
1. Verify `VITE_API_BASE_URL` matches CDK APIEndpoint output
2. Ensure URL includes `/prod` at the end
3. Check API Gateway is deployed: AWS Console → API Gateway

### Sign Up Email Not Received

**Solution:**
1. Check spam folder
2. Verify email in Cognito console
3. For development, you can skip verification:
   - Go to AWS Console → Cognito → User Pools → cloudforge-users
   - Users → Select user → Confirm user

## Verify Deployment

### Check CDK Stack

```bash
cd backend
npm run cdk:diff
# Should show "There were no differences"
```

### Check API Gateway

```bash
# Get API endpoint from CDK outputs
export API_URL="https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod"

# Test health (should return 404 - no root route configured yet)
curl $API_URL

# Test auth signup route (should return 400 - missing body)
curl -X POST $API_URL/auth/signup
```

### Check Lambda Functions

```bash
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `CloudForgeAIStack`)].FunctionName'

# Should list:
# - CloudForgeAIStack-SignUpFunction...
# - CloudForgeAIStack-SignInFunction...
# - CloudForgeAIStack-SignOutFunction...
# - CloudForgeAIStack-RefreshTokenFunction...
# - CloudForgeAIStack-GenerateArchitectureFunction...
```

### Check DynamoDB Tables

```bash
aws dynamodb list-tables --query 'TableNames[?starts_with(@, `cloudforge`)]'

# Should show:
# - cloudforge-users
# - cloudforge-diagrams
# - cloudforge-deployments
```

## Next Steps

After successful testing:

1. ✅ **Authentication works** - Sign up, sign in, token refresh
2. ✅ **AI generation works** - Generate architectures from descriptions
3. ✅ **API Gateway secure** - Protected routes require JWT token

Ready to continue with:
- **Task 6:** Visual architecture editor
- **Task 7:** Diagram persistence
- **Task 8:** CloudFormation generation

## Cleanup (Optional)

To remove all AWS resources and avoid charges:

```bash
cd backend
npm run cdk:destroy
```

**⚠️ Warning:** This deletes all data (users, diagrams, deployments)

## Cost Estimate

Running this stack costs approximately:
- **Lambda:** Free tier covers development usage
- **API Gateway:** $3.50 per million requests
- **DynamoDB:** Free tier covers development (25GB storage, 200M requests/month)
- **S3:** $0.023/GB/month
- **Cognito:** 50,000 MAU free
- **Bedrock:** ~$0.003 per 1000 input tokens, ~$0.015 per 1000 output tokens

**Estimated monthly cost for development:** $0-5

**Tips to minimize costs:**
- Delete stack when not in use (`npm run cdk:destroy`)
- Use DynamoDB on-demand billing (already configured)
- S3 Intelligent Tiering (already configured)
