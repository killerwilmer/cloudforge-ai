#!/bin/bash

# Clean compiled JavaScript files before CDK deployment
# This ensures TypeScript changes are always compiled fresh

echo "🧹 Cleaning compiled JavaScript files..."

# Remove all .js and .d.ts files from src directory
find src -name "*.js" -type f -delete
find src -name "*.d.ts" -type f -delete

echo "✅ Cleaned compiled files. Ready for deployment."
