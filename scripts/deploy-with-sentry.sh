#!/bin/bash

# SYNTHEX Deployment Script with Sentry Release Tracking
# This script handles deployment to Vercel with proper Sentry release management

echo "🚀 SYNTHEX Deployment with Sentry Integration"
echo "============================================"

# Check if required environment variables are set
if [ -z "$SENTRY_AUTH_TOKEN" ]; then
    echo "⚠️  Warning: SENTRY_AUTH_TOKEN not set. Sentry releases won't be created."
    echo "   Set it with: export SENTRY_AUTH_TOKEN=your-token"
fi

# Set Sentry configuration
export SENTRY_ORG=cleanexpo247
export SENTRY_PROJECT=synthex

# Get the version (git commit SHA or timestamp)
if command -v sentry-cli &> /dev/null; then
    VERSION=$(sentry-cli releases propose-version)
else
    VERSION=$(git rev-parse HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
fi

echo "📌 Deployment Version: $VERSION"

# Build the application
echo ""
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Aborting deployment."
    exit 1
fi

# Create Sentry release (if sentry-cli is available)
if command -v sentry-cli &> /dev/null && [ ! -z "$SENTRY_AUTH_TOKEN" ]; then
    echo ""
    echo "🚨 Creating Sentry release..."
    
    # Create new release
    sentry-cli releases new "$VERSION"
    
    # Associate commits with the release
    sentry-cli releases set-commits "$VERSION" --auto
    
    # Upload source maps
    echo "📤 Uploading source maps..."
    sentry-cli releases files "$VERSION" upload-sourcemaps .next --url-prefix "~/_next"
    
    # Finalize the release
    sentry-cli releases finalize "$VERSION"
    
    echo "✅ Sentry release $VERSION created"
else
    echo "⚠️  Skipping Sentry release creation (sentry-cli not found or token not set)"
fi

# Deploy to Vercel
echo ""
echo "☁️  Deploying to Vercel..."

# Set the release version as environment variable for Vercel
export NEXT_PUBLIC_SENTRY_RELEASE=$VERSION
export SENTRY_RELEASE=$VERSION

# Deploy to production
vercel --prod --yes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    
    # Mark deployment in Sentry (if available)
    if command -v sentry-cli &> /dev/null && [ ! -z "$SENTRY_AUTH_TOKEN" ]; then
        sentry-cli releases deploys "$VERSION" new -e production
        echo "📊 Deployment marked in Sentry"
    fi
    
    echo ""
    echo "🎉 SYNTHEX deployed successfully!"
    echo "   Version: $VERSION"
    echo "   URL: https://synthex.social"
    echo "   Sentry: https://sentry.io/organizations/cleanexpo247/projects/synthex/"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi