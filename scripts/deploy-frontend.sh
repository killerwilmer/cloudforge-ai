#!/bin/bash

# Deploy Frontend to S3 + CloudFront
# This script builds the React app and deploys it to AWS

set -e  # Exit on error

echo "🚀 CloudForge AI - Frontend Deployment"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

# Get CloudFormation outputs
echo ""
echo "📋 Fetching CloudFormation outputs..."
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name CloudForgeAIStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
    --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name CloudForgeAIStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name CloudForgeAIStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name CloudForgeAIStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name CloudForgeAIStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name CloudForgeAIStack \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' \
    --output text)

echo "✅ Stack outputs retrieved:"
echo "   API Endpoint: $API_ENDPOINT"
echo "   User Pool ID: $USER_POOL_ID"
echo "   Client ID: $CLIENT_ID"
echo "   S3 Bucket: $FRONTEND_BUCKET"
echo "   Distribution ID: $DISTRIBUTION_ID"

# Create production .env file
echo ""
echo "📝 Creating production environment file..."
cat > frontend/.env.production <<EOF
VITE_API_BASE_URL=$API_ENDPOINT
VITE_AWS_REGION=$REGION
VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_COGNITO_CLIENT_ID=$CLIENT_ID
VITE_ENABLE_GITHUB_IMPORT=false
VITE_ENABLE_COST_OPTIMIZATION=true
VITE_ENABLE_SECURITY_REVIEW=true
EOF

echo "✅ Production environment file created"

# Build frontend
echo ""
echo "🔨 Building frontend..."
cd frontend
npm run build
cd ..

echo "✅ Frontend built successfully"

# Upload to S3
echo ""
echo "📤 Uploading to S3..."
aws s3 sync frontend/dist/ s3://$FRONTEND_BUCKET/ \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --exclude "*.map"

# Upload index.html separately with no cache
aws s3 cp frontend/dist/index.html s3://$FRONTEND_BUCKET/index.html \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

echo "✅ Files uploaded to S3"

# Invalidate CloudFront cache
echo ""
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo "✅ CloudFront invalidation created: $INVALIDATION_ID"

# Final output
echo ""
echo "======================================"
echo "✅ Deployment Complete!"
echo "======================================"
echo ""
echo "🌐 Frontend URL: $CLOUDFRONT_URL"
echo "📡 API Endpoint: $API_ENDPOINT"
echo ""
echo "⏳ Note: CloudFront distribution may take 5-10 minutes to fully propagate"
echo "   You can check status at: https://console.aws.amazon.com/cloudfront/home"
echo ""
