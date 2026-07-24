---
title: Lambda Layer Dependency Management
inclusion: auto
---

# Lambda Layer Dependency Management

## Critical Rule: Always Update Layer package.json

When adding a new npm dependency to Lambda functions, you MUST update BOTH locations:

1. **Main package.json**: `/backend/package.json` (for development and testing)
2. **Layer package.json**: `/backend/layer/nodejs/package.json` (for Lambda runtime)

## Why This Happens

Lambda functions use a shared Lambda Layer for common dependencies. The layer is built separately from the main build process. If you only install in the main package.json, the dependency will work locally but fail in AWS Lambda with:

```
Error: Cannot find module 'package-name'
```

## Required Steps When Adding Dependencies

### Step 1: Install in Main Package
```bash
cd backend
npm install <package-name>
```

### Step 2: Add to Layer Package.json
Edit `/backend/layer/nodejs/package.json` and add the dependency:

```json
{
  "dependencies": {
    "existing-package": "^1.0.0",
    "new-package": "^2.0.0"  // ← Add here
  }
}
```

### Step 3: Rebuild Layer
```bash
cd backend
npm run build:layer
```

### Step 4: Redeploy
```bash
cd backend
npm run cdk:deploy -- --require-approval never
```

## Common Dependencies That Need Layer Updates

- **yaml** - YAML parsing (used in CloudFormation generation)
- **zod** - Schema validation
- **axios** - HTTP client (if not using AWS SDK)
- **lodash** - Utility functions
- Any npm package imported in Lambda code

## Verification

After deployment, check Lambda logs to verify no import errors:

```bash
aws logs tail /aws/lambda/<function-name> --follow
```

Look for: `Error: Cannot find module`

## Example: Adding yaml Package

**Problem**: Added `yaml` to main package.json, deployed, got runtime error

**Solution**:
1. ✅ Added to `/backend/package.json`
2. ✅ Added to `/backend/layer/nodejs/package.json`
3. ✅ Ran `npm run build:layer`
4. ✅ Ran `npm run cdk:deploy`

## Checklist

When you see "Cannot find module" error in Lambda:

- [ ] Check if dependency is in `/backend/layer/nodejs/package.json`
- [ ] If missing, add it
- [ ] Rebuild layer: `npm run build:layer`
- [ ] Redeploy stack: `npm run cdk:deploy`
- [ ] Verify in logs: `aws logs tail /aws/lambda/<function-name>`

## Prevention

Before deploying Lambda changes:

```bash
# Quick check - compare dependencies
echo "Main packages:"
cat backend/package.json | grep -A 20 '"dependencies"'

echo "\nLayer packages:"
cat backend/layer/nodejs/package.json | grep -A 20 '"dependencies"'
```

Ensure any package imported in Lambda code exists in BOTH locations.
