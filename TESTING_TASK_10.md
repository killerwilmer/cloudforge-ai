# Testing Guide: Task 10 - AWS Account Connection

## How to Test the UI

### 1. Start the Development Server

```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`

### 2. Login to the Application

1. Navigate to `http://localhost:5173`
2. Click "Get Started" or "Sign In"
3. Log in with your CloudForge credentials

### 3. Access AWS Connection Page

Once logged in, you have two ways to access the AWS Connection page:

**Option A: Via Navbar**
- Look at the top navigation bar
- Click on "AWS Connection" link

**Option B: Direct URL**
- Navigate directly to: `http://localhost:5173/aws-connection`

### 4. Test Connection Flow

#### If No Connection Exists:

1. **View Initial State**
   - You should see "No AWS Account Connected"
   - A "Connect AWS Account" button

2. **Click "Connect AWS Account"**
   - A wizard modal will appear

3. **Step 1: Setup Instructions**
   - Read the IAM role setup instructions
   - Copy the CloudForge Account ID: `610595225024`
   - Copy the generated External ID (unique per user)
   - Click "I've Created the Role"

4. **Step 2: Enter Connection Details**
   - Paste your IAM Role ARN (format: `arn:aws:iam::YOUR_ACCOUNT:role/RoleName`)
   - Optional: Enter the External ID if you configured one
   - Optional: Enter an Account Alias (friendly name)
   - Click "Connect Account"

5. **Step 3: Connecting**
   - See a spinner while the connection is being established

6. **Step 4: Success**
   - See confirmation with connection details:
     - Account ID
     - Account Alias
     - Role ARN
     - Expiration time
   - Click "Done"

#### If Connection Already Exists:

1. **View Connection Status**
   - Status badge: 🟢 Connected / 🟡 Expiring / 🔴 Expired
   - Account information displayed
   - Expiration timestamp shown

2. **Refresh Connection** (if expiring or expired)
   - Click "🔄 Refresh Connection" button
   - Credentials will be renewed for another hour

3. **Disconnect Account**
   - Click "Disconnect" button
   - Confirm the action in the dialog
   - Connection will be removed

### 5. Test Navigation

- Click "Generate" to go to architecture generation page
- Click "Visual Editor" to go to the editor
- Click "AWS Connection" to return to the connection page
- The navbar should be visible on all protected pages

## Creating an IAM Role in AWS (For Real Testing)

If you want to test with a real AWS account:

1. **Go to AWS Console**: https://console.aws.amazon.com/iam/home#/roles

2. **Create Role**:
   - Click "Create role"
   - Select "AWS account" → "Another AWS account"
   - Account ID: `610595225024` (CloudForge account)
   - Check "Require external ID"
   - External ID: Copy from the wizard (e.g., `cloudforge-1234567890-abc123`)

3. **Attach Permissions**:
   - For testing: `PowerUserAccess` (or a more restrictive policy)
   - For production: Custom policy with only needed permissions

4. **Name the Role**:
   - Role name: `CloudForgeDeploymentRole` (or any name you prefer)
   - Click "Create role"

5. **Copy Role ARN**:
   - Click on the newly created role
   - Copy the Role ARN (looks like: `arn:aws:iam::123456789012:role/CloudForgeDeploymentRole`)

6. **Use in CloudForge**:
   - Paste the Role ARN in the wizard form
   - Complete the connection

## Backend API Testing (Optional)

If you want to test the backend APIs directly:

### Prerequisites
- Get your JWT token from browser localStorage after logging in
- Set it as `ACCESS_TOKEN` environment variable

```bash
# Get connection status
curl -X GET https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/api/aws-connection/status \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Connect AWS account
curl -X POST https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/api/aws-connection/connect \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleArn": "arn:aws:iam::YOUR_ACCOUNT:role/CloudForgeRole",
    "externalId": "cloudforge-1234567890-abc123"
  }'

# Refresh connection
curl -X POST https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/api/aws-connection/refresh \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Disconnect
curl -X DELETE https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod/api/aws-connection/disconnect \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## Expected Behavior

### ✅ Success Cases

- **Connect**: Shows success with account details
- **Get Status**: Returns current connection state
- **Refresh**: Updates expiration time by 1 hour
- **Disconnect**: Removes connection and shows "No AWS Account Connected"

### ❌ Error Cases

- **Invalid Role ARN**: Shows "AssumeRole failed" error
- **Wrong External ID**: Shows "AssumeRole failed" error
- **No Permissions**: Shows "Access denied" error
- **Expired Token**: Redirects to login page

## UI Features to Test

1. **Responsive Design**:
   - Resize browser window
   - Test on mobile size (DevTools → Device Mode)
   - All elements should adjust properly

2. **Loading States**:
   - All buttons show loading text during operations
   - Spinner appears during connection
   - Buttons are disabled while loading

3. **Error Handling**:
   - Invalid input shows error messages
   - Failed connections show clear error text
   - Errors are dismissible

4. **Navigation**:
   - All navbar links work
   - Browser back/forward buttons work
   - Direct URL access works for protected routes

5. **Security Info**:
   - Scroll to bottom of page
   - Read security information cards
   - All text should be clear and informative

## Troubleshooting

### "Not authenticated" Error
- Clear localStorage: `localStorage.clear()`
- Log in again
- Try the connection flow

### Frontend Not Loading
```bash
cd frontend
npm install
npm run dev
```

### Backend API Errors
- Check if backend is deployed: `aws lambda list-functions | grep Connection`
- Check CloudWatch logs for detailed errors
- Verify Cognito token is valid

### CORS Errors
- Backend should allow frontend origin
- Check API Gateway CORS configuration
- Ensure Authorization header is properly set

## What to Look For

✅ **Good Signs**:
- Smooth wizard flow from start to finish
- Clear error messages when things go wrong
- Status updates in real-time
- Professional, clean UI design
- Mobile-responsive layout

❌ **Issues to Report**:
- Broken navigation links
- UI layout issues on mobile
- Unclear error messages
- Buttons that don't respond
- Missing information in forms

## Next Steps After Testing

Once you've confirmed Task 10 works correctly:
1. We can proceed to **Task 11: Build deployment pipeline with Step Functions**
2. The AWS connection established here will be used by the deployment pipeline
3. Task 11 will add actual CloudFormation deployment capabilities

---

**Questions?** Let me know if you encounter any issues during testing!
