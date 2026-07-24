# Development Guide

This guide explains the local development workflow for CloudForge AI.

## Quick Start

### First Time Setup

1. **Install dependencies:**
   ```bash
   npm run setup
   ```
   This installs dependencies for both frontend and backend.

2. **Configure environment variables:**
   ```bash
   # Frontend
   cd frontend
   cp .env.example .env.local
   # Edit .env.local with your values
   
   # Backend environment is set by CDK
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```
   This starts both frontend (Vite) and backend (TypeScript watch) in parallel.

## Development Commands

### Root-Level Commands

Run these from the project root to work with both frontend and backend:

```bash
# Start both dev servers with hot reload
npm run dev

# Build both projects
npm run build

# Run linting on both projects
npm run lint
npm run lint:fix

# Format code in both projects
npm run format

# Run all tests
npm test

# Type check both projects
npm run type-check

# Clean build artifacts and node_modules
npm run clean
```

### Frontend-Specific Commands

```bash
cd frontend

# Development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Type checking
npm run type-check

# Testing
npm test              # Run once
npm test -- --watch   # Watch mode
npm run test:coverage # With coverage
```

### Backend-Specific Commands

```bash
cd backend

# Watch mode (auto-rebuild on changes)
npm run watch

# Build TypeScript
npm run build

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Testing
npm test
npm run test:watch

# CDK commands
npm run cdk:synth     # Synthesize CloudFormation
npm run cdk:diff      # Show changes
npm run cdk:deploy    # Deploy to AWS
npm run cdk:destroy   # Destroy stack
```

## Hot Reload

### Frontend (Vite)

Vite provides instant hot module replacement (HMR):

- **React components**: Auto-refresh on save
- **TypeScript files**: Auto-recompile and refresh
- **CSS files**: Instant style updates without page reload
- **Config changes**: Require manual restart

**Port**: http://localhost:5173

### Backend (TypeScript Watch)

TypeScript watch mode recompiles on file changes:

- **Lambda functions**: Auto-recompile on save
- **Shared utilities**: Auto-recompile on save
- **CDK stacks**: Auto-recompile on save

Note: Backend changes don't auto-deploy. You need to run `npm run cdk:deploy` to update AWS resources.

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/my-feature

# Start dev servers
npm run dev

# Make changes (auto-reload active)
# Frontend: http://localhost:5173
# Backend: TypeScript compiles automatically

# Run tests
npm test

# Lint and format
npm run lint:fix
npm run format

# Commit changes
git add <files>
git commit -m "feat: add my feature"
```

### 2. Backend API Development

```bash
# Start TypeScript watch
cd backend
npm run watch

# Edit Lambda function
# File: src/lambdas/api/my-endpoint.ts

# Compile happens automatically

# Deploy to AWS
npm run cdk:deploy

# Test via API Gateway or locally
```

### 3. Frontend Component Development

```bash
# Start Vite dev server
cd frontend
npm run dev

# Create component
# File: src/components/MyComponent.tsx

# Changes reflect immediately

# Write tests
# File: src/components/MyComponent.test.tsx

# Run tests
npm test
```

## API Mocking for Local Development

The frontend Vite dev server is configured to proxy API requests:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

For local development without AWS:

1. **Option A**: Mock API responses in the frontend
2. **Option B**: Deploy backend to AWS and use real API
3. **Option C**: Use AWS SAM Local (coming soon)

## Environment Configuration

### Frontend (.env.local)

```env
# API Configuration
VITE_API_BASE_URL=https://your-api-gateway-url

# AWS Configuration
VITE_AWS_REGION=us-east-1

# Cognito (from CDK output)
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxx

# Feature Flags
VITE_ENABLE_GITHUB_IMPORT=false
VITE_ENABLE_COST_OPTIMIZATION=true
VITE_ENABLE_SECURITY_REVIEW=true
```

### Backend (set by CDK)

Backend Lambda functions receive environment variables from CDK:
- `AWS_REGION`
- `DYNAMODB_*_TABLE`
- `S3_*_BUCKET`
- `BEDROCK_MODEL_ID`
- `COGNITO_USER_POOL_ID`

## Debugging

### Frontend Debugging

**Browser DevTools:**
```javascript
// Chrome/Firefox DevTools
// Sources tab -> Open source file -> Set breakpoint
```

**VSCode Debugging:**
```json
// .vscode/launch.json
{
  "type": "chrome",
  "request": "launch",
  "name": "Launch Chrome",
  "url": "http://localhost:5173",
  "webRoot": "${workspaceFolder}/frontend/src"
}
```

### Backend Debugging

**VSCode Debugging:**
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Tests",
  "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "cwd": "${workspaceFolder}/backend"
}
```

**Lambda Local Testing:**
```bash
# Install AWS SAM CLI
brew install aws-sam-cli

# Invoke Lambda locally
sam local invoke MyFunction --event event.json
```

## Code Quality Checks

Before committing, run:

```bash
# Type check
npm run type-check

# Lint (auto-fix)
npm run lint:fix

# Format code
npm run format

# Run tests
npm test
```

## Common Issues

### Port Already in Use

```bash
# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9

# Kill process on port 3000 (backend)
lsof -ti:3000 | xargs kill -9
```

### TypeScript Errors After Pull

```bash
# Rebuild everything
npm run clean
npm run setup
npm run build
```

### Environment Variables Not Loading

```bash
# Frontend: Check .env.local exists
ls -la frontend/.env.local

# Restart dev server
npm run dev
```

### CDK Bootstrap Issues

```bash
# Bootstrap CDK (first time only)
cd backend
npm run cdk:bootstrap

# Check AWS credentials
aws sts get-caller-identity
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
npm run clean
npm run setup
```

## Performance Tips

### Frontend

- Use React DevTools Profiler to identify slow components
- Enable Vite's build analyzer: `npm run build -- --mode analyze`
- Lazy load routes: `const Page = lazy(() => import('./Page'))`

### Backend

- Optimize Lambda bundle size (< 50MB)
- Use Lambda Layers for shared dependencies
- Enable CloudWatch Insights for query performance

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add <files>
git commit -m "feat: description"

# Push to remote
git push -u origin feature/my-feature

# Create pull request
gh pr create
```

See `.kiro/steering/git-workflow.md` for complete guidelines.

## Next Steps

1. **Deploy infrastructure**: `cd backend && npm run cdk:deploy`
2. **Update frontend .env.local** with CDK outputs
3. **Start development**: `npm run dev`
4. **Build your first feature**: See tasks in `.kiro/specs/cloudforge-ai/tasks.md`

## Troubleshooting

For common issues, see [README.md](./README.md#troubleshooting).

For testing issues, see [TESTING.md](./TESTING.md).

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
