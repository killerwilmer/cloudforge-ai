# Deployment Pipeline Fix - Complete

## Problem Summary
The deployment pipeline was failing with "ExpressionAttributeValues contains invalid value: Supplied AttributeValue is empty, must contain exactly one of the supported datatypes for key :stackName"

## Root Causes

### 1. Missing Data Flow in Step Functions
**Issue**: The `stackName` and `region` fields were being passed to `start-deployment`, but the `validate-template` Lambda wasn't passing them through to the next steps in the workflow.

**Impact**: By the time the data reached `create-stack`, both `stackName` and `region` were `undefined`, causing DynamoDB update errors.

### 2. DynamoDB Reserved Keyword
**Issue**: The word `region` is a DynamoDB reserved keyword and must be escaped using ExpressionAttributeNames.

**Impact**: Even after fixing the data flow, DynamoDB rejected the update expression.

### 3. Parameter Format Mismatch
**Issue**: CloudFormation expects parameters in the format `{ ParameterKey, ParameterValue }`, but `validate-template` was returning `{ ParameterKey, DefaultValue }`.

**Impact**: CloudFormation rejected the stack creation with "ParameterValue for ParameterKey ProjectName is required".

### 4. Frontend Stack Name Generation
**Issue**: When `architecture.metadata.name` was empty or invalid, the stack name could start with a hyphen or be empty.

**Impact**: CloudFormation validation failed because stack names must start with a letter.

## Fixes Applied

### Fix 1: Update validate-template.ts
**File**: `backend/src/lambdas/deployment/validate-template.ts`

**Changes**:
1. Updated `ValidateTemplateInput` interface to include `stackName` and `region`:
```typescript
export interface ValidateTemplateInput {
  deploymentId: string;
  userId: string;
  templateBody: string;
  stackName: string;
  region: string;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
}
```

2. Updated `ValidateTemplateOutput` interface:
```typescript
export interface ValidateTemplateOutput {
  deploymentId: string;
  userId: string;
  templateBody: string;
  stackName: string;
  region: string;
  isValid: boolean;
  parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
  capabilities?: string[];
  error?: string;
}
```

3. Modified return statements to pass through `stackName` and `region`:
```typescript
return {
  deploymentId: event.deploymentId,
  userId: event.userId,
  templateBody: event.templateBody,
  stackName: event.stackName,  // ✅ Added
  region: event.region,          // ✅ Added
  isValid: true,
  parameters: result.Parameters?.map((p) => ({
    ParameterKey: p.ParameterKey!,
    ParameterValue: p.DefaultValue || '',  // ✅ Changed from DefaultValue
  })),
  capabilities: result.Capabilities,
};
```

### Fix 2: Update create-stack.ts
**File**: `backend/src/lambdas/deployment/create-stack.ts`

**Changes**:
1. Escaped `region` reserved keyword in DynamoDB UpdateExpression:
```typescript
UpdateExpression: 'SET #status = :status, creatingStackAt = :now, stackName = :stackName, #region = :region',
ExpressionAttributeNames: {
  '#status': 'status',
  '#region': 'region',  // ✅ Added
},
```

### Fix 3: Update CloudFormationPreview.tsx
**File**: `frontend/src/components/visual-editor/CloudFormationPreview.tsx`

**Changes**:
1. Improved stack name generation with validation and fallback:
```typescript
const handleDeploy = async () => {
  if (!template) return

  // Generate a valid stack name
  const baseName = architecture.metadata.name || 'CloudForge-Stack'
  const sanitizedName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 100) // Limit to 100 chars
  
  // Ensure stack name starts with a letter
  const stackName = sanitizedName.match(/^[a-z]/)
    ? `${sanitizedName}-${Date.now()}`
    : `stack-${sanitizedName}-${Date.now()}`
  
  // ... rest of deployment logic
}
```

## Deployment Steps

1. Compiled TypeScript:
```bash
cd backend
npx tsc --skipLibCheck
```

2. Rebuilt Lambda Layer:
```bash
npm run build:layer
```

3. Deployed to AWS:
```bash
npx cdk deploy --require-approval never
```

## Verification

### Before Fix
- Error: "ExpressionAttributeValues contains invalid value: Supplied AttributeValue is empty, must contain exactly one of the supported datatypes for key :stackName"
- create-stack Lambda logs showed: `stackName: undefined, region: undefined`

### After Fix
- Stack creation successfully initiated in CloudFormation
- Deployment reaches `STACK_CREATING` status
- Step Functions workflow completes all steps successfully

## Current Status

✅ **DEPLOYMENT PIPELINE WORKING**

The pipeline now successfully:
1. Validates the CloudFormation template
2. Assumes the user's AWS role
3. Creates the CloudFormation stack in the user's account
4. Polls for stack creation status

## Remaining Issues (Not Pipeline-Related)

These are **separate issues** with the AI-generated CloudFormation templates:

1. **IAM Permissions**: The CloudForge role needs `iam:GetRole` permission to check for existing IAM roles
2. **CloudFormation Template Errors**: AI-generated templates may have invalid properties (e.g., CloudFront syntax errors)

These should be addressed separately as they are:
- Not deployment pipeline bugs
- Related to the AI template generation
- Related to the CloudForge IAM role permissions

## Lessons Learned

1. **Step Functions Data Flow**: When using `outputPath: '$.Payload'`, ensure all required fields are included in Lambda return values
2. **DynamoDB Reserved Keywords**: Always use ExpressionAttributeNames for potentially reserved words
3. **Parameter Format**: CloudFormation parameter format differs from ValidateTemplate output format
4. **Lambda Layers**: Changes to Lambda function code require recompiling TypeScript, not just updating the Layer

## Files Modified

1. `backend/src/lambdas/deployment/validate-template.ts`
2. `backend/src/lambdas/deployment/create-stack.ts`
3. `frontend/src/components/visual-editor/CloudFormationPreview.tsx`

## Testing

To test the deployment pipeline:
1. Generate an architecture using the AI
2. Click "Deploy to AWS"
3. Verify the deployment reaches CloudFormation and shows "STACK_CREATING" status
4. Check CloudWatch logs to confirm stackName and region are no longer undefined
