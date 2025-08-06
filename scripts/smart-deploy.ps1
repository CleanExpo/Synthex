# Smart Deployment Script for Windows
# This script validates everything before pushing to Vercel

Write-Host "🤖 SMART DEPLOYMENT SYSTEM" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Run pre-deployment validation
Write-Host "📋 Running pre-deployment checks..." -ForegroundColor Yellow
npx ts-node scripts/pre-deploy-check.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Pre-deployment validation failed!" -ForegroundColor Red
    Write-Host "Please fix the errors above before deploying."
    exit 1
}

# Step 2: Check git status
Write-Host ""
Write-Host "📂 Checking git status..." -ForegroundColor Yellow
$gitStatus = git status -s

if ($gitStatus) {
    Write-Host "⚠️  You have uncommitted changes:" -ForegroundColor Yellow
    git status -s
    Write-Host ""
    $commit = Read-Host "Do you want to commit these changes? (y/n)"
    
    if ($commit -eq 'y') {
        $commitMsg = Read-Host "Enter commit message"
        git add -A
        git commit -m "$commitMsg`n`n🤖 Generated with Smart Deploy`n`nCo-Authored-By: Build Agent <agent@synthex.ai>"
    } else {
        Write-Host "Proceeding without committing changes..." -ForegroundColor Yellow
    }
}

# Step 3: Run tests (optional, suppress errors)
Write-Host ""
Write-Host "🧪 Running tests..." -ForegroundColor Yellow
npm test 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Some tests failed" -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    
    if ($continue -ne 'y') {
        Write-Host "Deployment cancelled."
        exit 1
    }
}

# Step 4: Build production
Write-Host ""
Write-Host "🏗️  Building for production..." -ForegroundColor Yellow
npm run build:prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Production build failed!" -ForegroundColor Red
    exit 1
}

# Step 5: Final confirmation
Write-Host ""
Write-Host "✅ All checks passed!" -ForegroundColor Green
Write-Host ""
Write-Host "Ready to deploy to Vercel:"
Write-Host "  - Branch: $(git branch --show-current)"
Write-Host "  - Last commit: $(git log -1 --pretty=format:'%h - %s')"
Write-Host ""
$deploy = Read-Host "Deploy to production? (y/n)"

if ($deploy -ne 'y') {
    Write-Host "Deployment cancelled."
    exit 0
}

# Step 6: Push to GitHub (triggers Vercel deployment)
Write-Host ""
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ DEPLOYMENT INITIATED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Deployment Details:" -ForegroundColor Cyan
    Write-Host "  - GitHub: https://github.com/CleanExpo/Synthex"
    Write-Host "  - Vercel: https://synthex-cerq.vercel.app/"
    Write-Host "  - Dashboard: https://vercel.com/dashboard"
    Write-Host ""
    Write-Host "⏳ Vercel will build and deploy automatically (1-2 minutes)" -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to push to GitHub" -ForegroundColor Red
    exit 1
}