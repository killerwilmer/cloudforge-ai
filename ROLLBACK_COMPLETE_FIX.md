# ROLLBACK_COMPLETE Status Support

## Issue
Deployments with `ROLLBACK_COMPLETE` status (stacks that were created but rolled back due to errors) were not showing the delete button.

## Solution
Extended the delete functionality to support `ROLLBACK_COMPLETE` status alongside other failed deployment statuses.

## Changes Made

### Frontend - DeploymentHistoryPage.tsx
1. **Updated `canDelete` function** to include `ROLLBACK_COMPLETE`:
   ```typescript
   const canDelete = (status: string) => {
     return ['FAILED', 'POLL_STATUS_FAILED', 'VALIDATION_FAILED', 'ROLLBACK_COMPLETE'].includes(status)
   }
   ```

2. **Updated status badge styling** to show `ROLLBACK_COMPLETE` as an error (red badge with ✗):
   ```typescript
   if (status === 'FAILED' || ... || status === 'ROLLBACK_COMPLETE') return 'badge-error'
   ```

3. **Updated failed deployments counter** to include `ROLLBACK_COMPLETE` in the "Failed" stat

4. **Updated in-progress counter** to include `ROLLBACK_IN_PROGRESS` 

## Status Handling

| Status | Badge Color | Icon | Delete Button | Description |
|--------|-------------|------|---------------|-------------|
| `COMPLETED` | Green | ✓ | ❌ No | Successfully deployed |
| `FAILED` | Red | ✗ | ✅ Yes | Deployment failed |
| `POLL_STATUS_FAILED` | Red | ✗ | ✅ Yes | Status polling failed |
| `VALIDATION_FAILED` | Red | ✗ | ✅ Yes | Template validation failed |
| `ROLLBACK_COMPLETE` | Red | ✗ | ✅ Yes | Stack rolled back after failure |
| `IN_PROGRESS` | Blue | ⟳ | ❌ No | Deployment in progress |
| `VALIDATING` | Blue | ⟳ | ❌ No | Validating template |
| `ROLLBACK_IN_PROGRESS` | Blue | ⟳ | ❌ No | Rolling back changes |

## What Happens on Delete

For `ROLLBACK_COMPLETE` deployments:
1. User clicks 🗑️ Delete button
2. Confirmation dialog appears
3. Backend receives DELETE request
4. Backend checks if `stackId` exists (it should for rolled-back stacks)
5. Backend calls CloudFormation `DeleteStack` API
6. Backend updates deployment status to `DELETING` in DynamoDB
7. CloudFormation deletes the rolled-back stack
8. User sees status change to `DELETING` or deployment removed from list

## Why This Matters

When a CloudFormation deployment fails, AWS automatically rolls back the changes. This leaves the stack in `ROLLBACK_COMPLETE` state. These stacks:
- Still exist in CloudFormation (cluttering your AWS Console)
- Count against service limits
- May hold resources that weren't properly cleaned up
- Should be deleted to maintain a clean AWS environment

Now users can easily clean up these failed deployments directly from CloudForge AI.

## Build Status
✅ Frontend builds successfully
✅ TypeScript compilation passes
✅ All types aligned with backend

## Testing
1. Navigate to Deployment History
2. Look for deployments with red "ROLLBACK_COMPLETE" badge
3. Verify delete button (🗑️) appears
4. Click delete and confirm
5. Verify CloudFormation stack deletion is initiated
6. Check AWS Console to confirm stack is being deleted

## Related Files
- `frontend/src/pages/DeploymentHistoryPage.tsx` - Main changes
- `frontend/src/types/deployment.ts` - Type definitions
- `backend/src/lambdas/deployment/delete-stack.ts` - Backend handler
