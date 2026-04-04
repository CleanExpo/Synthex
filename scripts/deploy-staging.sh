#!/bin/bash

# SYNTHEX Staging Deployment Script
# This script deploys the application to the staging environment

set -e

echo "🚀 Starting SYNTHEX Staging Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BRANCH="staging"
ENVIRONMENT="staging"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if on correct branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "$BRANCH" ]; then
    print_warning "Not on staging branch. Switching to staging..."
    git checkout $BRANCH || git checkout -b $BRANCH
fi

# Pull latest changes
print_status "Pulling latest changes..."
git pull origin $BRANCH || true

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Run tests
print_status "Running tests..."
npm run test:ci || {
    print_error "Tests failed! Aborting deployment."
    exit 1
}

# Run linting
print_status "Running linting..."
npm run lint || {
    print_warning "Linting warnings detected"
}

# Build the application
print_status "Building application..."
npm run build:prod || {
    print_error "Build failed! Aborting deployment."
    exit 1
}

# Run database migrations
print_status "Running database migrations..."
npx prisma migrate deploy || {
    print_error "Database migration failed!"
    exit 1
}

# Deploy to Vercel Staging
print_status "Deploying to Vercel Staging..."
npx vercel --prod --env-file .env.staging --yes --token $VERCEL_TOKEN --scope $VERCEL_SCOPE || {
    print_error "Vercel deployment failed!"
    exit 1
}

# Get deployment URL
DEPLOYMENT_URL=$(npx vercel ls --token $VERCEL_TOKEN --scope $VERCEL_SCOPE | grep staging | head -1 | awk '{print $2}')

# Run smoke tests
print_status "Running smoke tests on staging..."
STAGING_URL=$DEPLOYMENT_URL npm run test:e2e:staging || {
    print_warning "Smoke tests failed on staging"
}

# Notify team
print_status "Deployment successful!"
echo ""
echo "📦 Staging Environment Details:"
echo "   URL: https://staging.synthex.social"
echo "   Branch: $BRANCH"
echo "   Environment: $ENVIRONMENT"
echo "   Deployment: $DEPLOYMENT_URL"
echo ""

# Create deployment record
echo "{
  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"environment\": \"$ENVIRONMENT\",
  \"branch\": \"$BRANCH\",
  \"commit\": \"$(git rev-parse HEAD)\",
  \"deployer\": \"$(git config user.name)\",
  \"url\": \"$DEPLOYMENT_URL\"
}" > .last-staging-deployment.json

print_status "Deployment record created"

# Optional: Send notification to Slack/Discord
# curl -X POST -H 'Content-type: application/json' \
#   --data "{\"text\":\"Staging deployment successful! View at: $DEPLOYMENT_URL\"}" \
#   $SLACK_WEBHOOK_URL

exit 0