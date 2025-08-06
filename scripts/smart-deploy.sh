#!/bin/bash

# Smart Deployment Script with Pre-flight Checks
# This script validates everything before pushing to Vercel

echo "🤖 SMART DEPLOYMENT SYSTEM"
echo "=========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Run pre-deployment validation
echo "📋 Running pre-deployment checks..."
npx ts-node scripts/pre-deploy-check.ts

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Pre-deployment validation failed!${NC}"
    echo "Please fix the errors above before deploying."
    exit 1
fi

# Step 2: Check git status
echo ""
echo "📂 Checking git status..."
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes:${NC}"
    git status -s
    echo ""
    read -p "Do you want to commit these changes? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " commit_msg
        git add -A
        git commit -m "$commit_msg

🤖 Generated with Smart Deploy

Co-Authored-By: Build Agent <agent@synthex.ai>"
    else
        echo -e "${YELLOW}Proceeding without committing changes...${NC}"
    fi
fi

# Step 3: Run tests
echo ""
echo "🧪 Running tests..."
npm test 2>/dev/null

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Step 4: Build production
echo ""
echo "🏗️  Building for production..."
npm run build:prod

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Production build failed!${NC}"
    exit 1
fi

# Step 5: Final confirmation
echo ""
echo -e "${GREEN}✅ All checks passed!${NC}"
echo ""
echo "Ready to deploy to Vercel:"
echo "  - Branch: $(git branch --show-current)"
echo "  - Last commit: $(git log -1 --pretty=format:'%h - %s')"
echo ""
read -p "Deploy to production? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 6: Push to GitHub (triggers Vercel deployment)
echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ DEPLOYMENT INITIATED!${NC}"
    echo ""
    echo "📊 Deployment Details:"
    echo "  - GitHub: https://github.com/CleanExpo/Synthex"
    echo "  - Vercel: https://synthex-cerq.vercel.app/"
    echo "  - Dashboard: https://vercel.com/dashboard"
    echo ""
    echo "⏳ Vercel will build and deploy automatically (1-2 minutes)"
else
    echo -e "${RED}❌ Failed to push to GitHub${NC}"
    exit 1
fi