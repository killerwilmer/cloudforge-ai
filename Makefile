.PHONY: help setup dev build test lint format clean deploy

# Default target
help:
	@echo "CloudForge AI - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup      - Install all dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev        - Start frontend and backend dev servers"
	@echo "  make dev-fe     - Start frontend dev server only"
	@echo "  make dev-be     - Start backend watch mode only"
	@echo ""
	@echo "Build:"
	@echo "  make build      - Build frontend and backend"
	@echo "  make build-fe   - Build frontend only"
	@echo "  make build-be   - Build backend only"
	@echo ""
	@echo "Quality:"
	@echo "  make test       - Run all tests"
	@echo "  make lint       - Run linting"
	@echo "  make lint-fix   - Fix linting issues"
	@echo "  make format     - Format code"
	@echo "  make check      - Run type-check, lint, and test"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy     - Deploy backend to AWS"
	@echo "  make synth      - Synthesize CloudFormation"
	@echo "  make diff       - Show infrastructure changes"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean      - Remove build artifacts"
	@echo "  make clean-all  - Remove build artifacts and node_modules"

# Setup
setup:
	@echo "📦 Installing dependencies..."
	@npm run setup

# Development
dev:
	@echo "🚀 Starting development servers..."
	@npm run dev

dev-fe:
	@echo "🚀 Starting frontend dev server..."
	@cd frontend && npm run dev

dev-be:
	@echo "🚀 Starting backend watch mode..."
	@cd backend && npm run watch

# Build
build:
	@echo "🔨 Building projects..."
	@npm run build

build-fe:
	@echo "🔨 Building frontend..."
	@cd frontend && npm run build

build-be:
	@echo "🔨 Building backend..."
	@cd backend && npm run build

# Quality
test:
	@echo "🧪 Running tests..."
	@npm run test

lint:
	@echo "🔍 Running linters..."
	@npm run lint

lint-fix:
	@echo "🔧 Fixing lint issues..."
	@npm run lint:fix

format:
	@echo "✨ Formatting code..."
	@npm run format

check: lint test
	@echo "✅ Running type-check, lint, and test..."
	@npm run type-check

# Deployment
deploy:
	@echo "🚀 Deploying to AWS..."
	@cd backend && npm run cdk:deploy

synth:
	@echo "📝 Synthesizing CloudFormation..."
	@cd backend && npm run cdk:synth

diff:
	@echo "📊 Showing infrastructure diff..."
	@cd backend && npm run cdk:diff

# Maintenance
clean:
	@echo "🧹 Cleaning build artifacts..."
	@cd frontend && rm -rf dist .vite
	@cd backend && rm -rf lib cdk.out

clean-all: clean
	@echo "🧹 Removing node_modules..."
	@rm -rf node_modules frontend/node_modules backend/node_modules
