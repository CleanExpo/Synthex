# SYNTHEX Deployment Script with Sentry Release Tracking (Windows)
# PowerShell script for deployment to Vercel with Sentry integration

Write-Host "🚀 SYNTHEX Deployment with Sentry Integration" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check if required environment variables are set
if (-not $env:SENTRY_AUTH_TOKEN) {
    Write-Host "⚠️  Warning: SENTRY_AUTH_TOKEN not set." -ForegroundColor Yellow
    Write-Host "   Set it with: `$env:SENTRY_AUTH_TOKEN='your-token'" -ForegroundColor Yellow
    Write-Host "   Or add to your system environment variables" -ForegroundColor Yellow
}

# Set Sentry configuration
$env:SENTRY_ORG = "cleanexpo247"
$env:SENTRY_PROJECT = "synthex"

# Check if sentry-cli is installed
$sentryCliExists = Get-Command sentry-cli -ErrorAction SilentlyContinue

# Get the version
if ($sentryCliExists) {
    $VERSION = & sentry-cli releases propose-version
} else {
    # Use git commit SHA or timestamp
    $gitExists = Get-Command git -ErrorAction SilentlyContinue
    if ($gitExists) {
        $VERSION = & git rev-parse HEAD
    } else {
        $VERSION = Get-Date -Format "yyyyMMddHHmmss"
    }
}

Write-Host "📌 Deployment Version: $VERSION" -ForegroundColor Green
Write-Host ""

# Build the application
Write-Host "📦 Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Aborting deployment." -ForegroundColor Red
    exit 1
}

# Create Sentry release (if sentry-cli is available and token is set)
if ($sentryCliExists -and $env:SENTRY_AUTH_TOKEN) {
    Write-Host ""
    Write-Host "🚨 Creating Sentry release..." -ForegroundColor Yellow
    
    # Create new release
    & sentry-cli releases new "$VERSION"
    
    # Associate commits with the release
    & sentry-cli releases set-commits "$VERSION" --auto
    
    # Upload source maps
    Write-Host "📤 Uploading source maps..." -ForegroundColor Yellow
    & sentry-cli releases files "$VERSION" upload-sourcemaps .next --url-prefix "~/_next"
    
    # Finalize the release
    & sentry-cli releases finalize "$VERSION"
    
    Write-Host "✅ Sentry release $VERSION created" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skipping Sentry release (sentry-cli not found or token not set)" -ForegroundColor Yellow
}

# Deploy to Vercel
Write-Host ""
Write-Host "☁️  Deploying to Vercel..." -ForegroundColor Yellow

# Set the release version as environment variable for Vercel
$env:NEXT_PUBLIC_SENTRY_RELEASE = $VERSION
$env:SENTRY_RELEASE = $VERSION

# Deploy to production
vercel --prod --yes

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    
    # Mark deployment in Sentry (if available)
    if ($sentryCliExists -and $env:SENTRY_AUTH_TOKEN) {
        & sentry-cli releases deploys "$VERSION" new -e production
        Write-Host "📊 Deployment marked in Sentry" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🎉 SYNTHEX deployed successfully!" -ForegroundColor Green
    Write-Host "   Version: $VERSION" -ForegroundColor Cyan
    Write-Host "   URL: https://synthex.social" -ForegroundColor Cyan
    Write-Host "   Sentry: https://sentry.io/organizations/cleanexpo247/projects/synthex/" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}