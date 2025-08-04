# Vercel CLI Deployment Script with Token
# This script uses the Vercel CLI for more control over deployments

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    Vercel CLI Deployment Setup for Synthex      " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "Vercel CLI not found. Installing..." -ForegroundColor Yellow
    Write-Host ""
    npm install -g vercel
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install Vercel CLI. Please install manually:" -ForegroundColor Red
        Write-Host "npm install -g vercel" -ForegroundColor White
        exit 1
    }
    Write-Host "✓ Vercel CLI installed successfully!" -ForegroundColor Green
    Write-Host ""
}

# Check for existing token in environment or file
$token = $env:VERCEL_TOKEN

if (-not $token -and (Test-Path ".env.deploy")) {
    $envContent = Get-Content ".env.deploy" | Where-Object { $_ -match "^VERCEL_TOKEN=" }
    if ($envContent) {
        $token = ($envContent -split "=", 2)[1].Trim()
    }
}

if (-not $token) {
    Write-Host "No Vercel token found. Let's set one up!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To get a Vercel token:" -ForegroundColor White
    Write-Host "1. Go to: https://vercel.com/account/tokens" -ForegroundColor Cyan
    Write-Host "2. Click 'Create'" -ForegroundColor White
    Write-Host "3. Name it: 'synthex-deploy'" -ForegroundColor White
    Write-Host "4. Set expiration as needed" -ForegroundColor White
    Write-Host "5. Click 'Create Token'" -ForegroundColor White
    Write-Host "6. Copy the token" -ForegroundColor White
    Write-Host ""
    
    $token = Read-Host "Paste your Vercel token here" -AsSecureString
    $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
    
    if (-not $token) {
        Write-Host "No token provided. Exiting..." -ForegroundColor Red
        exit 1
    }
    
    # Save token to .env.deploy file
    if (Test-Path ".env.deploy") {
        $envContent = Get-Content ".env.deploy"
        $tokenLine = "VERCEL_TOKEN=$token"
        
        if ($envContent -match "^VERCEL_TOKEN=") {
            $envContent = $envContent -replace "^VERCEL_TOKEN=.*", $tokenLine
        } else {
            $envContent += "`n$tokenLine"
        }
        
        $envContent | Set-Content ".env.deploy"
    } else {
        "VERCEL_TOKEN=$token" | Out-File ".env.deploy" -Encoding UTF8
    }
    
    Write-Host "✓ Token saved to .env.deploy" -ForegroundColor Green
    Write-Host ""
}

# Set environment variable for this session
$env:VERCEL_TOKEN = $token

# Deployment options
Write-Host "Select deployment type:" -ForegroundColor Yellow
Write-Host "1. Production deployment (recommended)" -ForegroundColor White
Write-Host "2. Preview deployment" -ForegroundColor White
Write-Host "3. Development deployment" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-3)"

Write-Host ""
Write-Host "Starting deployment..." -ForegroundColor Yellow
Write-Host ""

switch ($choice) {
    "1" {
        Write-Host "Deploying to PRODUCTION..." -ForegroundColor Cyan
        vercel --prod --token $token --yes
    }
    "2" {
        Write-Host "Creating PREVIEW deployment..." -ForegroundColor Cyan
        vercel --token $token --yes
    }
    "3" {
        Write-Host "Creating DEVELOPMENT deployment..." -ForegroundColor Cyan
        vercel --dev --token $token
    }
    default {
        Write-Host "Defaulting to PRODUCTION deployment..." -ForegroundColor Cyan
        vercel --prod --token $token --yes
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "View your deployment at:" -ForegroundColor White
    Write-Host "https://vercel.com/dashboard/synthex" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "✗ Deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Verify your token is valid" -ForegroundColor White
    Write-Host "2. Check your internet connection" -ForegroundColor White
    Write-Host "3. Ensure you're in the project directory" -ForegroundColor White
    Write-Host "4. Try running: vercel --debug" -ForegroundColor White
}

Write-Host ""
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host