# AWS Connection Setup Instructions

## Issue: Connection Refresh Failing

You're seeing a 403 error when trying to refresh the AWS connection because the IAM role setup is missing or expired.

## Quick Fix: Disconnect and Skip for Now

Since this is a hackathon project, you can skip the AWS connection for now:

1. **Click "Disconnect"** on the AWS Connection page
2. Continue building other features
3. For deployment testing, you can:
   - Deploy CloudFormation templates directly via AWS Console
   - Test the deployment monitoring UI with mock data
   - Focus on the visual editor and cost optimization features

## Proper Setup (Optional - For Production)

If you want to set up the AWS connection properly:

### Step 1: Create IAM Role

1. Go to AWS Console → IAM → Roles → Create Role
2. Select "AWS account" as trusted entity
3. Select "Another AWS account"
4. Enter your AWS Account ID: `610595225024`
5. Check "Require external ID" and enter any unique value (save it!)
6. Attach policies:
   - `AmazonEC2FullAccess`
   - `AmazonS3FullAccess`  
   - `AWSCloudFormationFullAccess`
   - `IAMFullAccess`
7. Name the role: `CloudForgeDeploymentRole`
8. Create role

### Step 2: Update Trust Policy

Edit the trust policy to allow the Lambda to assume it:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::610595225024:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_EXTERNAL_ID_HERE"
        }
      }
    }
  ]
}
```

### Step 3: Connect in CloudForge

1. Go to `/aws-connection` page
2. Enter the Role ARN: `arn:aws:iam::610595225024:role/CloudForgeDeploymentRole`
3. Enter the External ID you created
4. Click "Connect AWS Account"

## Alternative: Use Lambda's Own Credentials

For hackathon demos, you can modify the deployment Lambda to use its own IAM role instead of assuming a role:

1. Grant the deployment Lambda permissions directly
2. Skip the AWS connection flow entirely
3. Deploy stacks using the Lambda's credentials

This is simpler for demos but less secure for production.

## Next Steps

**For now, recommend**: 
- Click "Disconnect" to clear the expired connection
- Focus on completing Task 12 (Deployment Monitoring UI)
- Test deployments using AWS Console manually
- Set up proper IAM role later if needed

The deployment monitoring UI will work regardless of how the deployment is triggered!
