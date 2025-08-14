# SYNTHEX Sentry Configuration Script (Windows PowerShell)
# Quick setup for Sentry environment variables

param(
    [Parameter(Mandatory=$true)]
    [string]$DSN,
    
    [Parameter(Mandatory=$false)]
    [string]$AuthToken = ""
)

Write-Host "🚨 Configuring Sentry for SYNTHEX" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Validate DSN format
if (-not $DSN.StartsWith("https://")) {
    Write-Host "❌ Invalid DSN format. Must start with https://" -ForegroundColor Red
    exit 1
}

# Extract project ID from DSN (format: https://[key]@[org].ingest.sentry.io/[project_id])
$projectId = ""
if ($DSN -match "https://.*@.*\.ingest\.sentry\.io/(\d+)") {
    $projectId = $Matches[1]
    Write-Host "✅ Detected Project ID: $projectId" -ForegroundColor Green
}

# Create or update .env.local
$envPath = Join-Path $PSScriptRoot ".." ".env.local"
$envContent = ""

if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    # Remove existing Sentry configuration
    $envContent = $envContent -replace "(?m)^.*SENTRY.*$", ""
    $envContent = $envContent -replace "(?m)^\s*$", ""
    Write-Host "📝 Updating existing .env.local file" -ForegroundColor Yellow
} else {
    Write-Host "📝 Creating new .env.local file" -ForegroundColor Yellow
}

# Add Sentry configuration
$newConfig = @"

# ====================================
# Sentry Error Tracking Configuration
# ====================================
# Organization: cleanexpo247
# Project: javascript-react
# Dashboard: https://sentry.io/organizations/cleanexpo247/projects/javascript-react/

# Required for all environments
NEXT_PUBLIC_SENTRY_DSN=$DSN
SENTRY_DSN=$DSN

# Optional: For source map uploads (production builds)
$(if ($AuthToken) { "SENTRY_AUTH_TOKEN=$AuthToken" } else { "# SENTRY_AUTH_TOKEN=your_auth_token_here" })
SENTRY_ORG=cleanexpo247
SENTRY_PROJECT=javascript-react

# Environment settings
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_ENVIRONMENT=production

# Performance monitoring (optional)
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1

# Release tracking (auto-generated)
# SENTRY_RELEASE will be set during deployment
"@

$envContent = $envContent.TrimEnd() + "`n" + $newConfig
Set-Content -Path $envPath -Value $envContent -NoNewline

Write-Host "✅ Created/Updated .env.local with Sentry configuration" -ForegroundColor Green
Write-Host ""

# Update Vercel environment variables instructions
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "=============" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Add these environment variables to Vercel Dashboard:" -ForegroundColor Yellow
Write-Host "   https://vercel.com/cleanexpo247/synthex/settings/environment-variables" -ForegroundColor Gray
Write-Host ""
Write-Host "   NEXT_PUBLIC_SENTRY_DSN = $DSN" -ForegroundColor White
Write-Host "   SENTRY_DSN = $DSN" -ForegroundColor White

if ($AuthToken) {
    Write-Host "   SENTRY_AUTH_TOKEN = $AuthToken" -ForegroundColor White
}

Write-Host "   SENTRY_ORG = cleanexpo247" -ForegroundColor White
Write-Host "   SENTRY_PROJECT = javascript-react" -ForegroundColor White
Write-Host "   SENTRY_ENVIRONMENT = production" -ForegroundColor White
Write-Host "   NEXT_PUBLIC_SENTRY_ENVIRONMENT = production" -ForegroundColor White
Write-Host ""

Write-Host "2. Test locally:" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host "   Visit: http://localhost:3000/api/sentry-test" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Deploy to production:" -ForegroundColor Yellow
Write-Host "   .\scripts\deploy-with-sentry.ps1" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Verify in Sentry Dashboard:" -ForegroundColor Yellow
Write-Host "   https://sentry.io/organizations/cleanexpo247/projects/javascript-react/" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Configuration complete!" -ForegroundColor Green
Write-Host ""

# Test the configuration
$testLocal = Read-Host "Would you like to test the configuration locally? (y/n)"
if ($testLocal -eq 'y') {
    Write-Host ""
    Write-Host "🧪 Starting local test server..." -ForegroundColor Yellow
    Set-Location (Join-Path $PSScriptRoot "..")
    npm run dev
}