# Fix IAM Permissions for CloudForge Deployments

## Problem
CloudFormation deployments are failing with:
```
User: arn:aws:sts::610595225024:assumed-role/CloudForge/cloudforge-deployment-xxx 
is not authorized to perform: iam:GetRole on resource: role xxx
```

## Your Current Policy (Good!)

Your current policy uses `NotAction` which is the **scalable approach** ✅:
- Allows everything except IAM admin, Organizations, Account management
- Automatically supports new AWS services
- Only need to add specific IAM actions needed by CloudFormation

## Solution: Add IAM Actions for CloudFormation

CloudFormation needs specific IAM permissions to create resources. Add a third statement to your existing policy:

### Update via AWS Console (Recommended)

1. **Go to IAM Console**
   - Navigate to: https://console.aws.amazon.com/iam/
   - Click **Roles** in the left sidebar
   - Find the role: `CloudForge` or `CloudForgeDeploymentRole`

2. **Edit the Existing Policy**
   - Click on the role name
   - Go to **Permissions** tab
   - Find your current policy and click **Edit**
   - Add this new statement to the existing `Statement` array:

```json
{
    "Sid": "AllowIAMForCloudFormation",
    "Effect": "Allow",
    "Action": [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:DeleteRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:PassRole",
        "iam:TagRole",
        "iam:UntagRole"
    ],
    "Resource": "*",
    "Condition": {
        "StringEquals": {
            "aws:RequestedRegion": [
                "us-east-1",
                "us-west-2"
            ]
        }
    }
}
```

3. **Save the Policy**
   - The complete policy should now have 3 statements
   - The condition restricts IAM actions to specific regions for additional security

### Complete Policy Example

Your policy should look like this:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "NotAction": [
                "iam:*",
                "organizations:*",
                "account:*"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "account:GetAccountInformation",
                "account:GetGovCloudAccountInformation",
                "account:GetPrimaryEmail",
                "account:ListRegions",
                "iam:CreateServiceLinkedRole",
                "iam:DeleteServiceLinkedRole",
                "iam:ListRoles",
                "organizations:DescribeEffectivePolicy",
                "organizations:DescribeOrganization"
            ],
            "Resource": "*"
        },
        {
            "Sid": "AllowIAMForCloudFormation",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:GetRole",
                "iam:DeleteRole",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:GetRolePolicy",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:ListAttachedRolePolicies",
                "iam:ListRolePolicies",
                "iam:PassRole",
                "iam:TagRole",
                "iam:UntagRole"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "aws:RequestedRegion": [
                        "us-east-1",
                        "us-west-2"
                    ]
                }
            }
        }
    ]
}
```

## Why This Approach Is Better

✅ **Scalable**: Your `NotAction` approach automatically supports new AWS services
✅ **Secure**: Only grants specific IAM permissions needed for CloudFormation
✅ **Limited**: IAM actions restricted to specific regions via Condition
✅ **No Admin Access**: Doesn't grant dangerous IAM admin permissions like:
   - Creating users
   - Modifying account settings
   - Creating access keys
   - Modifying the CloudForge role itself

## What IAM Permissions Are Needed?

CloudFormation needs these IAM actions to:
- **Create IAM roles** for Lambda functions, ECS tasks, etc.
- **Get/read roles** to check if they already exist
- **Attach policies** to grant permissions to Lambda/ECS
- **Pass roles** to other AWS services
- **Delete roles** when stacks are deleted

## Alternative: Further Restrict by Resource

If you want even more security, restrict IAM actions to specific resource patterns:

```json
{
    "Sid": "AllowIAMForCloudFormation",
    "Effect": "Allow",
    "Action": [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:DeleteRole",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:PassRole",
        "iam:TagRole",
        "iam:UntagRole"
    ],
    "Resource": [
        "arn:aws:iam::*:role/*-dev-*",
        "arn:aws:iam::*:role/*-staging-*",
        "arn:aws:iam::*:role/*-prod-*"
    ],
    "Condition": {
        "StringEquals": {
            "aws:RequestedRegion": [
                "us-east-1",
                "us-west-2"
            ]
        }
    }
}
```

This limits IAM actions to roles that match naming patterns (contain `-dev-`, `-staging-`, or `-prod-`).

## After Updating Permissions

1. **Refresh your AWS connection** (if needed):
   - Go to the AWS Connection page in CloudForge
   - Click "Refresh Connection"

2. **Try deploying again**:
   - Generate an architecture with the AI
   - Click "Deploy to AWS"
   - The IAM permission errors should be resolved

## Troubleshooting

### Still Getting iam:GetRole Errors?
- Verify the new statement was added correctly
- Check that it's in the same policy document
- Ensure there's no typo in the Action names

### Want to Test the Policy?
Use the IAM Policy Simulator:
1. Go to https://policysim.aws.amazon.com/
2. Select the CloudForge role
3. Test `iam:CreateRole` and `iam:GetRole` actions
4. Should show "allowed"

### Need More Permissions?
If you get other permission denied errors:
1. Check the CloudWatch logs for the exact action denied
2. Add that specific action to statement #3
3. Your `NotAction` in statement #1 already allows most services!
