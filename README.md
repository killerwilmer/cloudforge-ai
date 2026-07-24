# CloudForge AI

AWS Infrastructure Design and Deployment Platform powered by AI.

## Overview

CloudForge AI enables users to design, optimize, and deploy AWS infrastructure through:
- 🤖 AI-powered architecture generation using natural language
- 🎨 Interactive visual diagram editor
- ⚡ Automated CloudFormation deployment
- 💰 Cost optimization recommendations
- 🔒 Security review and hardening
- 📈 Scalability analysis

## Project Structure

```
cloudforge-ai/
├── frontend/          # React + Vite frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # Business logic
│   │   ├── types/         # TypeScript types
│   │   ├── utils/         # Utilities
│   │   ├── hooks/         # Custom React hooks
│   │   ├── api/           # API client
│   │   └── config/        # Configuration
│   └── package.json
├── backend/           # AWS CDK infrastructure and Lambda functions
│   ├── bin/          # CDK app entry point
│   ├── lib/          # CDK stacks
│   ├── src/
│   │   ├── lambdas/      # Lambda function handlers
│   │   └── shared/       # Shared code (types, utils)
│   ├── cdk.json
│   └── package.json
└── .kiro/            # Kiro AI configuration
    ├── specs/        # Project specifications
    └── steering/     # Coding standards and workflows
```

## Prerequisites

- **Node.js**: v20.x or later
- **npm**: v10.x or later
- **AWS Account**: With appropriate permissions
- **AWS CLI**: Configured with credentials
- **AWS CDK**: v2.x (installed via npm)
- **Amazon Bedrock Access**: Claude 3.5 Sonnet enabled in your AWS account

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Clone the repository
cd /path/to/cloudforge-ai

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 2. Configure Environment Variables

#### Frontend

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local` and set:
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_AWS_REGION=us-east-1
# Cognito values will be filled after CDK deployment
```

#### Backend

The backend environment variables are set automatically by CDK during deployment.
For local development reference, see `backend/.env.example`.

### 3. Bootstrap AWS CDK (First Time Only)

```bash
cd backend
npm run cdk:bootstrap
```

This creates the necessary S3 bucket and IAM roles for CDK deployments.

### 4. Deploy Backend Infrastructure

```bash
cd backend
npm run cdk:deploy
```

This will:
- Create DynamoDB tables (users, diagrams, deployments)
- Create S3 buckets (diagrams, templates)
- Set up Cognito User Pool for authentication
- Deploy API Gateway with Lambda functions
- Configure IAM roles and permissions

**⚠️ Important**: Save the CloudFormation outputs! You'll need:
- `UserPoolId`
- `UserPoolClientId`
- `APIEndpoint`

### 5. Update Frontend Configuration

After deployment, update `frontend/.env.local` with the values from CDK outputs:

```env
VITE_COGNITO_USER_POOL_ID=<UserPoolId from CDK output>
VITE_COGNITO_CLIENT_ID=<UserPoolClientId from CDK output>
VITE_API_BASE_URL=<APIEndpoint from CDK output>
```

### 6. Start Development Servers

#### Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

#### Backend (for local testing)

```bash
cd backend
npm run watch
```

This watches for TypeScript changes and recompiles automatically.

## Development Workflow

### Frontend Development

```bash
cd frontend

# Start dev server with hot reload
npm run dev

# Type check
npm run type-check

# Lint
npm run lint
npm run lint:fix

# Format code
npm run format

# Build for production
npm run build
```

### Backend Development

```bash
cd backend

# Build TypeScript
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Synthesize CloudFormation template
npm run cdk:synth

# See infrastructure diff
npm run cdk:diff

# Deploy changes
npm run cdk:deploy

# Destroy infrastructure (⚠️ careful!)
npm run cdk:destroy
```

### Root-Level Commands

```bash
# Run from project root to work with both projects

# Start both dev servers
npm run dev

# Run all tests
npm test

# Lint everything
npm run lint
npm run lint:fix

# Format all code
npm run format

# Build everything
npm run build
```

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development workflow guide.

## Architecture

### Frontend Stack
- **React 18+** with TypeScript
- **Vite** for fast builds and HMR
- **React Flow** for visual diagram editing
- **Monaco Editor** for code preview
- **React Router** for navigation

### Backend Stack
- **AWS CDK** for infrastructure as code
- **Lambda** (Node.js 20.x) for serverless compute
- **API Gateway** for HTTP API
- **DynamoDB** for data storage
- **S3** for diagram and template storage
- **Cognito** for user authentication
- **Bedrock** (Claude 3.5 Sonnet) for AI generation
- **Step Functions** for deployment orchestration

## Security

This project follows strict security practices:

1. **No hardcoded secrets** - All credentials via environment variables
2. **No PII in logs** - Structured logging without sensitive data
3. **Input validation** - All user inputs validated at API boundaries
4. **Parameterized queries** - No SQL/NoSQL injection vulnerabilities
5. **HTTPS only** - All communications encrypted
6. **IAM least privilege** - Minimal required permissions

See `.kiro/steering/security-rules.md` for complete security guidelines.

## Git Workflow

- Create feature branches: `feature/description`
- Use conventional commits: `feat:`, `fix:`, `refactor:`, etc.
- Stage files explicitly (no `git add .`)
- Never commit to `main` directly

See `.kiro/steering/git-workflow.md` for complete guidelines.

## Testing

```bash
# Frontend tests (coming soon)
cd frontend
npm test

# Backend tests (coming soon)
cd backend
npm test
```

## Troubleshooting

### CDK Deployment Fails

1. Ensure AWS credentials are configured: `aws sts get-caller-identity`
2. Check you have the required IAM permissions
3. Verify CDK is bootstrapped: `cdk bootstrap`

### Bedrock Access Denied

1. Request access to Claude 3.5 Sonnet in AWS Console → Bedrock → Model access
2. Wait for approval (usually instant)
3. Ensure your IAM role has `bedrock:InvokeModel` permission

### Frontend Can't Connect to API

1. Verify API Gateway URL in `.env.local`
2. Check CORS configuration in CDK stack
3. Ensure Cognito credentials are correct

## Contributing

1. Follow coding standards in `.kiro/steering/coding-standards.md`
2. Write tests for new features
3. Update documentation
4. Create pull requests with clear descriptions

## License

MIT

## Support

For issues and questions:
- Create a GitHub issue
- Check the troubleshooting section
- Review the spec documents in `.kiro/specs/`
