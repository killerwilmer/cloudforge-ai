# Delete Button Locations

## Two Places to Delete Deployments

The delete button now appears in **two locations** for failed deployments:

### 1. Deployment History Page (List View)
**URL:** `/deployments` or http://localhost:5173/deployments

**Location:** Each failed deployment card shows a 🗑️ Delete button in the bottom-right corner

**Access:**
1. Click "Deployment History" from the main navigation
2. Look for deployments with red error badges
3. Delete button appears next to "View Details →" and "AWS Console ↗"

**Appearance:**
```
┌─────────────────────────────────────────────────┐
│ untitled-architecture-xxx           ✗ FAILED    │
│ us-east-1                                        │
│                                                  │
│ Started: 7/25/2026, 1:48:33 PM                  │
│ Failed: 7/25/2026, 1:48:35 PM                   │
│                                                  │
│ [View Details →] [AWS Console ↗] [🗑️ Delete]   │
└─────────────────────────────────────────────────┘
```

### 2. Deployment Details Page (Individual View)
**URL:** `/deployments/{id}` or http://localhost:5173/deployments/xxx

**Location:** Top-right corner of the page header, next to "View in AWS Console →"

**Access:**
1. Click on any failed deployment from the history list
2. OR navigate directly to a deployment URL
3. Delete button appears in the header section

**Appearance:**
```
← Back to Deployments

untitled-architecture-xxx
Region: us-east-1  Started: 7/25/2026, 1:48:33 PM

                    [View in AWS Console →] [🗑️ Delete Stack]

○ STACK_CREATING
```

## Which Statuses Show Delete Button?

The delete button appears ONLY for these statuses:
- ❌ `FAILED` - Deployment failed
- ❌ `POLL_STATUS_FAILED` - Lost connection to deployment
- ❌ `VALIDATION_FAILED` - Template didn't pass validation
- ❌ `ROLLBACK_COMPLETE` - Stack was created but rolled back

## Which Statuses DON'T Show Delete Button?

- ✅ `COMPLETED` - Successfully deployed (protected from deletion)
- ⟳ `IN_PROGRESS` - Currently deploying (wait until finished)
- ⟳ `VALIDATING` - Validating template (wait until finished)
- ⟳ `ROLLBACK_IN_PROGRESS` - Rolling back changes (wait until finished)
- ⟳ `DELETING` - Already being deleted

## How to Test

### Test on List Page:
1. Start your frontend: `cd frontend && npm run dev`
2. Navigate to http://localhost:5173/deployments
3. Look for failed deployments in the list
4. You should see 🗑️ Delete button on each failed deployment

### Test on Details Page:
1. Click on a failed deployment or navigate to its URL
2. Look at the top-right corner of the page
3. You should see "🗑️ Delete Stack" button next to "View in AWS Console →"

## Troubleshooting

### "I don't see the delete button"
**Check these:**
1. Is the deployment status one of the deletable statuses? (FAILED, ROLLBACK_COMPLETE, etc.)
2. Did you refresh the page after rebuilding? (Ctrl+Shift+R or Cmd+Shift+R)
3. Are you looking in the right location? (List page vs Details page)
4. Check browser console for any JavaScript errors

### "The button is grayed out"
- The button is disabled while a deletion is in progress
- Wait for the operation to complete or refresh the page

### "I see the button on the list but not on details"
- Refresh the details page to get the latest code
- Clear browser cache and reload

### "I see the button on details but not on the list"
- Refresh the list page to get the latest code
- Clear browser cache and reload

## Developer Notes

### Implementation Files:
- **List Page:** `frontend/src/pages/DeploymentHistoryPage.tsx`
- **Details Page:** `frontend/src/pages/DeploymentStatusPage.tsx`
- **Service:** `frontend/src/services/deployment.service.ts`
- **Backend:** `backend/src/lambdas/deployment/delete-stack.ts`

### Key Changes:
1. **DeploymentHistoryPage.tsx** - Delete button in card actions
2. **DeploymentStatusPage.tsx** - Delete button in page header
3. Both pages now check for the same failed statuses
4. Both pages use the same `deploymentService.deleteDeployment()` API call

### Security:
- Confirmation dialog required before deletion
- Only deployment owner can delete (verified by backend)
- Only failed deployments can be deleted (completed ones protected)
