# Vercel Deployment Hook Setup Script
# This script helps you set up a deployment trigger for Vercel

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     Vercel Deployment Hook Setup for Synthex     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will help you create a manual deployment trigger." -ForegroundColor Yellow
Write-Host ""

Write-Host "STEP 1: Create a Deploy Hook" -ForegroundColor Green
Write-Host "----------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "1. Open your browser and go to:" -ForegroundColor White
Write-Host "   https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Select your 'synthex' project" -ForegroundColor White
Write-Host ""
Write-Host "3. Go to Settings -> Git" -ForegroundColor White
Write-Host ""
Write-Host "4. Scroll down to 'Deploy Hooks' section" -ForegroundColor White
Write-Host ""
Write-Host "5. Click 'Create Hook' with these settings:" -ForegroundColor White
Write-Host "   - Name: manual-deploy" -ForegroundColor Yellow
Write-Host "   - Branch: main" -ForegroundColor Yellow
Write-Host ""
Write-Host "6. Click 'Create Hook' button" -ForegroundColor White
Write-Host ""
Write-Host "7. Copy the webhook URL that appears" -ForegroundColor White
Write-Host ""

Write-Host "Press Enter when you have the webhook URL ready..." -ForegroundColor Magenta
Read-Host

Write-Host ""
Write-Host "STEP 2: Save Your Deploy Hook" -ForegroundColor Green
Write-Host "-----------------------------" -ForegroundColor Green
Write-Host ""

$hookUrl = Read-Host "Paste your Deploy Hook URL here"

if (-not $hookUrl) {
    Write-Host ""
    Write-Host "No URL provided. Exiting..." -ForegroundColor Red
    exit 1
}

# Validate URL format
if ($hookUrl -notmatch "^https://api\.vercel\.com/v1/integrations/deploy/") {
    Write-Host ""
    Write-Host "Warning: This doesn't look like a valid Vercel deploy hook URL." -ForegroundColor Yellow
    Write-Host "Expected format: https://api.vercel.com/v1/integrations/deploy/..." -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}

Write-Host ""
Write-Host "Creating deployment scripts..." -ForegroundColor Yellow

# Create PowerShell trigger script
$psScript = @"
# Vercel Manual Deployment Script for Synthex
# Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

`$webhookUrl = "$hookUrl"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Synthex - Triggering Vercel Deploy  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Sending deployment request..." -ForegroundColor Yellow

try {
    `$response = Invoke-WebRequest -Uri `$webhookUrl -Method POST -UseBasicParsing
    
    if (`$response.StatusCode -eq 200 -or `$response.StatusCode -eq 201) {
        Write-Host ""
        Write-Host "✓ Deployment triggered successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check deployment status at:" -ForegroundColor White
        Write-Host "https://vercel.com/dashboard/synthex" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or visit your app at:" -ForegroundColor White
        Write-Host "https://synthex-h4j7.vercel.app/" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "⚠ Unexpected status code: `$(`$response.StatusCode)" -ForegroundColor Yellow
        Write-Host "Response: `$(`$response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host ""
    Write-Host "✗ Deployment request failed!" -ForegroundColor Red
    Write-Host "Error: `$(`$_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check your internet connection" -ForegroundColor White
    Write-Host "2. Verify the webhook URL is correct" -ForegroundColor White
    Write-Host "3. Regenerate the hook in Vercel if needed" -ForegroundColor White
}

Write-Host ""
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host
"@

$psScript | Out-File -FilePath "trigger-deploy.ps1" -Encoding UTF8

# Create batch file for easy execution
$batchScript = @"
@echo off
echo.
echo ==========================================
echo    Synthex - Vercel Deployment Trigger
echo ==========================================
echo.
powershell.exe -ExecutionPolicy Bypass -File trigger-deploy.ps1
"@

$batchScript | Out-File -FilePath "deploy.bat" -Encoding ASCII

# Create Node.js script as alternative
$nodeScript = @"
// Vercel Deployment Trigger for Synthex
// Generated on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

const https = require('https');

const DEPLOY_HOOK = '$hookUrl';

console.log('');
console.log('==========================================');
console.log('   Synthex - Triggering Vercel Deploy    ');
console.log('==========================================');
console.log('');

console.log('Sending deployment request...');

const url = new URL(DEPLOY_HOOK);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('');
      console.log('✓ Deployment triggered successfully!');
      console.log('');
      console.log('Check deployment status at:');
      console.log('https://vercel.com/dashboard/synthex');
      console.log('');
      console.log('Response:', data);
    } else {
      console.log('');
      console.log('⚠ Unexpected status code:', res.statusCode);
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('');
  console.error('✗ Deployment request failed!');
  console.error('Error:', error.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('1. Check your internet connection');
  console.error('2. Verify the webhook URL is correct');
  console.error('3. Regenerate the hook in Vercel if needed');
});

req.end();
"@

$nodeScript | Out-File -FilePath "deploy.js" -Encoding UTF8

# Create environment file template (but don't save the actual hook)
$envTemplate = @"
# Vercel Deployment Configuration
# IMPORTANT: Do not commit this file to Git!

# Your Vercel Deploy Hook (keep this secret!)
VERCEL_DEPLOY_HOOK=$hookUrl

# Optional: Vercel Token for CLI deployments
# VERCEL_TOKEN=your_vercel_token_here

# Optional: Project Configuration
# VERCEL_ORG_ID=your_org_id
# VERCEL_PROJECT_ID=your_project_id
"@

$envTemplate | Out-File -FilePath ".env.deploy" -Encoding UTF8

# Update .gitignore to exclude sensitive files
$gitignoreAdditions = @"

# Deployment files
.env.deploy
trigger-deploy.ps1
deploy.bat
deploy.js
"@

if (Test-Path ".gitignore") {
    Add-Content -Path ".gitignore" -Value $gitignoreAdditions
} else {
    $gitignoreAdditions | Out-File -FilePath ".gitignore" -Encoding UTF8
}

Write-Host ""
Write-Host "✓ SUCCESS! Deployment scripts created:" -ForegroundColor Green
Write-Host ""
Write-Host "  📄 trigger-deploy.ps1  - PowerShell deployment script" -ForegroundColor White
Write-Host "  📄 deploy.bat         - Batch file for easy execution" -ForegroundColor White
Write-Host "  📄 deploy.js          - Node.js alternative script" -ForegroundColor White
Write-Host "  📄 .env.deploy        - Environment configuration" -ForegroundColor White
Write-Host ""

Write-Host "STEP 3: Test Your Deployment" -ForegroundColor Green
Write-Host "----------------------------" -ForegroundColor Green
Write-Host ""
Write-Host "You can now trigger a deployment using any of these:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Option 1 (Easiest):" -ForegroundColor Cyan
Write-Host "  ./deploy.bat" -ForegroundColor White
Write-Host ""
Write-Host "  Option 2 (PowerShell):" -ForegroundColor Cyan
Write-Host "  ./trigger-deploy.ps1" -ForegroundColor White
Write-Host ""
Write-Host "  Option 3 (Node.js):" -ForegroundColor Cyan
Write-Host "  node deploy.js" -ForegroundColor White
Write-Host ""

Write-Host "Would you like to trigger a test deployment now? (y/n)" -ForegroundColor Magenta
$testNow = Read-Host

if ($testNow -eq 'y') {
    Write-Host ""
    & ./trigger-deploy.ps1
} else {
    Write-Host ""
    Write-Host "Setup complete! Run './deploy.bat' anytime to deploy." -ForegroundColor Green
    Write-Host ""
}