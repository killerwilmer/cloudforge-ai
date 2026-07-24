# Frontend URLs & Routes

## Development Server

**Base URL**: http://localhost:5174/

> **Note**: Port may vary (5173-5175) depending on availability. Check terminal output for actual port.

## Available Routes

### 🌐 Public Routes

#### `/` - Landing Page
- **URL**: http://localhost:5174/
- **Description**: Homepage with hero section, features showcase, and call-to-action
- **Features**:
  - Animated architecture preview
  - 4 feature cards (AI-Powered, Visual Editor, IaC, Security)
  - Step-by-step "How it Works" workflow
  - Responsive gradient design
  - Dynamic navigation based on auth state
- **Actions**:
  - "Get Started Free" → Redirects to `/auth` (if not logged in) or `/generate` (if logged in)
  - "Sign In" button → Redirects to `/auth`

#### `/auth` - Authentication
- **URL**: http://localhost:5174/auth
- **Description**: Login and sign-up forms with toggle
- **Features**:
  - Toggle between Login and Sign Up modes
  - Email + password authentication
  - Email verification flow (6-digit code)
  - AWS Cognito integration
  - Form validation and error messages
- **Success Behavior**:
  - After sign up → Shows login form with success message
  - After login → Redirects to `/generate`

### 🔒 Protected Routes (Require Authentication)

#### `/generate` - AI Architecture Generator
- **URL**: http://localhost:5174/generate
- **Description**: Main application feature - AI-powered AWS architecture generation
- **Access**: Requires authentication (redirects to `/auth` if not logged in)
- **Features**:
  - Rich text area for problem description (20-2000 characters)
  - Real-time character count with warnings
  - AI generation powered by Amazon Bedrock (Claude 3.5 Sonnet)
  - Visual architecture display:
    - Service cards with AWS service types
    - Connection lines between services
    - Metadata (name, description, region)
    - Statistics (services count, connections count)
  - Token usage display (input/output/total tokens)
  - Export actions:
    - "Open in Visual Editor" (Task 6 - coming soon)
    - "Generate CloudFormation" (Task 7 - coming soon)
- **Loading State**: Animated spinner with progress messages
- **Error Handling**: Clear error messages for API failures

### 🚫 404 Handling

Any unmatched route redirects to `/` (landing page).

## Navigation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Landing Page (/)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Click "Get Started Free" or "Sign In"               │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        ↓                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Check: Is user authenticated?                       │   │
│  └───────────┬─────────────────────────┬───────────────┘   │
│              ↓ NO                       ↓ YES               │
│   ┌──────────────────┐       ┌──────────────────────┐      │
│   │  /auth           │       │  /generate           │      │
│   │  Sign Up/Login   │       │  (Protected)         │      │
│   └──────┬───────────┘       └──────────────────────┘      │
│          ↓                                                   │
│   ┌──────────────────┐                                      │
│   │ Sign Up Flow:    │                                      │
│   │ 1. Enter email   │                                      │
│   │ 2. Enter password│                                      │
│   │ 3. Verify email  │                                      │
│   │ 4. Login         │                                      │
│   └──────┬───────────┘                                      │
│          ↓                                                   │
│   ┌──────────────────┐                                      │
│   │ Redirect to      │                                      │
│   │ /generate        │                                      │
│   └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

## Testing Checklist

### ✅ Landing Page (`/`)
- [ ] Page loads without errors
- [ ] Hero section displays with animations
- [ ] Feature cards are visible
- [ ] "Get Started" button works
- [ ] Navigation shows "Sign In" when not authenticated
- [ ] Navigation shows "Welcome, [email]" when authenticated
- [ ] Smooth scroll to "#features" section works
- [ ] Footer displays correctly
- [ ] Responsive design works on mobile

### ✅ Auth Page (`/auth`)
- [ ] Page loads without errors
- [ ] Toggle between Login/Sign Up works
- [ ] Form validation shows errors
- [ ] Sign Up flow:
  - [ ] Creates user in Cognito
  - [ ] Sends verification email
  - [ ] Shows verification code input
  - [ ] Verifies code successfully
- [ ] Login flow:
  - [ ] Authenticates with valid credentials
  - [ ] Shows error for invalid credentials
  - [ ] Stores access token in localStorage
  - [ ] Redirects to `/generate` on success

### ✅ Generate Page (`/generate`)
- [ ] Redirects to `/auth` if not authenticated
- [ ] Page loads for authenticated users
- [ ] Description textarea works
- [ ] Character count updates in real-time
- [ ] Validation prevents submission with < 20 chars
- [ ] Validation prevents submission with > 2000 chars
- [ ] "Generate Architecture" button triggers API call
- [ ] Loading state displays during generation
- [ ] Generated architecture displays correctly:
  - [ ] Architecture name and description
  - [ ] Service cards with types
  - [ ] Connection count
  - [ ] Region information
  - [ ] Token usage statistics
- [ ] "Clear" button resets form
- [ ] Error messages display for API failures

## API Endpoints Used

### Authentication (Cognito)

- **POST** `/auth/signup` - Create user account
- **POST** `/auth/verify` - Verify email with code
- **POST** `/auth/signin` - Login with credentials
- **POST** `/auth/signout` - Sign out user
- **POST** `/auth/refresh` - Refresh access token

### AI Features (Bedrock)

- **POST** `/architecture/generate` - Generate AWS architecture from description

## Environment Variables

The frontend requires these environment variables in `frontend/.env.local`:

```env
# API Gateway endpoint (from CDK output)
VITE_API_BASE_URL=https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod

# AWS Region
VITE_AWS_REGION=us-east-1

# Cognito User Pool (from CDK output)
VITE_COGNITO_USER_POOL_ID=us-east-1_ZPAf8RtfQ
VITE_COGNITO_CLIENT_ID=44pnpbu7e2q779dm86bb4ac3tb
```

> **Important**: Restart dev server after changing environment variables.

## Quick Start

```bash
# 1. Configure environment
cd frontend
cp .env.example .env.local
# Edit .env.local with CDK outputs

# 2. Start dev server
npm run dev

# 3. Open browser
open http://localhost:5174/

# 4. Test the flow
# → Visit landing page
# → Click "Get Started"
# → Sign up for account
# → Verify email
# → Sign in
# → Generate architecture
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5174
lsof -ti:5174 | xargs kill -9

# Or let Vite choose another port (5175, 5176, etc.)
```

### Routes Not Working (404)
- Check that `BrowserRouter` is configured in `App.tsx`
- Verify no typos in route paths
- Clear browser cache and hard refresh (Cmd+Shift+R)

### Environment Variables Not Loading
```bash
# Verify .env.local exists
ls -la frontend/.env.local

# Restart dev server
npm run dev
```

### Protected Route Redirects to `/auth`
- Check authentication state in browser DevTools → Application → Local Storage
- Look for `accessToken` key
- Try signing in again

### API Calls Failing (CORS or 401)
- Verify `VITE_API_BASE_URL` matches CDK output
- Check AWS API Gateway has CORS enabled
- Verify Cognito credentials are correct
- Check browser Network tab for error details

### Hot Reload Not Working
```bash
# Restart dev server
# Stop with Ctrl+C, then:
npm run dev
```

## Component Files Reference

```
frontend/src/
├── App.tsx                          # Route configuration
├── pages/
│   ├── LandingPage.tsx             # / route
│   ├── LandingPage.css             # Landing page styles
│   ├── AuthPage.tsx                # /auth route
│   ├── GenerateArchitecturePage.tsx # /generate route
│   └── GenerateArchitecturePage.css
├── components/auth/
│   ├── ProtectedRoute.tsx          # Auth guard HOC
│   ├── LoginForm.tsx               # Login form component
│   └── SignUpForm.tsx              # Sign up form component
├── contexts/
│   └── AuthContext.tsx             # Auth state provider
└── services/
    ├── auth/                       # Cognito API calls
    └── ai-engine/                  # Bedrock API calls
```

## Browser Testing

**Recommended browsers:**
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

**DevTools tips:**
- **Console**: Check for errors/warnings
- **Network**: Monitor API calls and responses
- **Application → Local Storage**: View stored tokens
- **React DevTools**: Inspect component state
- **Redux DevTools**: Not used (using Context API)

## Performance

### Expected Load Times
- Landing page: ~100-200ms (first load)
- Auth page: ~50-100ms (cached assets)
- Generate page: ~50-100ms (cached assets)
- AI generation: ~10-30 seconds (Bedrock API call)

### Bundle Sizes (Production)
```bash
npm run build
# Check dist/ folder sizes
```

Expected sizes:
- Main bundle: ~200-300 KB (gzipped)
- Vendor bundle: ~150-250 KB (React, React Router)
- CSS bundle: ~20-30 KB (gzipped)

## Next Steps

After confirming all routes work:

1. **Test authentication flow end-to-end**
2. **Enable Bedrock model access** in AWS Console (Claude 3.5 Sonnet)
3. **Generate a test architecture** with a real problem description
4. **Proceed to Task 6**: Visual Editor Implementation (React Flow canvas)

## Resources

- [React Router v7 Docs](https://reactrouter.com/)
- [Vite Documentation](https://vitejs.dev/)
- [AWS Cognito Auth Flow](https://docs.aws.amazon.com/cognito/)
- [Amazon Bedrock](https://aws.amazon.com/bedrock/)
