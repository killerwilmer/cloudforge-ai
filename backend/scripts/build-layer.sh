#!/bin/bash
# Build script for Lambda Layer
# Creates a properly structured layer with dependencies

set -e

echo "Building Lambda Layer..."

# Create layer directory structure
LAYER_DIR="layer"
rm -rf $LAYER_DIR
mkdir -p $LAYER_DIR/nodejs

# Copy shared code
echo "Copying shared code..."
cp -r src/shared $LAYER_DIR/nodejs/

# Create package.json for layer dependencies
cat > $LAYER_DIR/nodejs/package.json << 'EOF'
{
  "name": "cloudforge-shared-layer",
  "version": "1.0.0",
  "description": "Shared utilities and AWS SDK clients for CloudForge AI",
  "dependencies": {
    "@aws-sdk/client-cognito-identity-provider": "^3.0.0",
    "@aws-sdk/client-dynamodb": "^3.0.0",
    "@aws-sdk/client-s3": "^3.0.0",
    "@aws-sdk/client-secrets-manager": "^3.0.0",
    "@aws-sdk/client-bedrock-runtime": "^3.0.0",
    "@aws-sdk/client-cloudformation": "^3.0.0",
    "@aws-sdk/client-sts": "^3.0.0",
    "@aws-sdk/client-pricing": "^3.0.0",
    "@aws-sdk/lib-dynamodb": "^3.0.0",
    "yaml": "^2.0.0"
  }
}
EOF

# Install dependencies in layer
echo "Installing dependencies..."
cd $LAYER_DIR/nodejs
npm install --production --no-package-lock
cd ../..

echo "Layer built successfully at $LAYER_DIR/"
echo "Layer size: $(du -sh $LAYER_DIR | cut -f1)"
