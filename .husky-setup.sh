#!/bin/bash

# Husky setup script for CloudForge AI
# Run this after npm install to set up git hooks

echo "🪝 Setting up Git hooks..."

# Install husky
npm install --save-dev husky

# Initialize husky
npx husky init

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run type check
echo "📝 Type checking..."
npm run type-check || exit 1

# Run linting
echo "🔍 Linting..."
npm run lint || exit 1

# Run tests
echo "🧪 Running tests..."
npm run test || exit 1

echo "✅ Pre-commit checks passed!"
EOF

# Make hook executable
chmod +x .husky/pre-commit

echo "✅ Git hooks setup complete!"
echo ""
echo "The following checks will run before each commit:"
echo "  - Type checking"
echo "  - Linting"
echo "  - Tests"
echo ""
echo "To skip hooks (not recommended), use: git commit --no-verify"
