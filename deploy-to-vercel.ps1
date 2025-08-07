#!/usr/bin/env pwsh

# SYNTHEX - Deploy Environment Variables to Vercel
# PowerShell script for Windows users

Write-Host "SYNTHEX - Vercel Environment Setup" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray
Write-Host ""

# Check if Vercel CLI is installed
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

Write-Host "Setting up production environment variables..." -ForegroundColor Yellow
Write-Host ""

# Read .env file if it exists
$envFile = ".env"
if (Test-Path $envFile) {
    Write-Host "Found .env file" -ForegroundColor Green
    
    # Parse .env file
    $envVars = @{}
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            
            # Skip example values and database URLs with exposed passwords
            if ($value -notmatch '\[.*\]' -and 
                $value -notmatch 'your-.*' -and
                $key -ne 'NODE_ENV' -and
                $key -ne 'PORT' -and
                -not ($key -match 'DATABASE' -and $value -match 'lX2WLK2mB8Ucrjdv')) {
                $envVars[$key] = $value
            }
        }
    }
    
    Write-Host "Found $($envVars.Count) valid environment variables" -ForegroundColor Cyan
    Write-Host ""
    
    # Confirm before proceeding
    Write-Host "The following variables will be added to Vercel:" -ForegroundColor Yellow
    $envVars.Keys | ForEach-Object {
        $displayValue = if ($envVars[$_].Length -gt 20) {
            $envVars[$_].Substring(0, 10) + "..."
        } else {
            $envVars[$_]
        }
        Write-Host "  - $_`: $displayValue" -ForegroundColor Gray
    }
    
    Write-Host ""
    $response = Read-Host "Do you want to continue? (y/n)"
    
    if ($response -eq 'y') {
        Write-Host ""
        Write-Host "Adding variables to Vercel..." -ForegroundColor Yellow
        
        # Link to Vercel project
        vercel link
        
        # Add each environment variable
        foreach ($key in $envVars.Keys) {
            Write-Host "Setting $key..." -ForegroundColor Gray
            
            # Use echo to pipe the value to vercel env add
            $value = $envVars[$key]
            echo $value | vercel env add $key production
        }
        
        # Add production-specific overrides
        Write-Host ""
        Write-Host "Setting production overrides..." -ForegroundColor Yellow
        echo "production" | vercel env add NODE_ENV production
        
        Write-Host ""
        Write-Host "Environment variables configured!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Verify variables: vercel env ls production" -ForegroundColor Gray
        Write-Host "  2. Deploy to production: vercel --prod" -ForegroundColor Gray
        Write-Host "  3. Check deployment: vercel ls" -ForegroundColor Gray
        Write-Host ""
        
    } else {
        Write-Host "Setup cancelled" -ForegroundColor Red
    }
    
} else {
    Write-Host "No .env file found" -ForegroundColor Red
    Write-Host "Please create a .env file with your environment variables" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Security Reminders:" -ForegroundColor Yellow
Write-Host "  - Never commit .env files to git" -ForegroundColor Gray
Write-Host "  - Rotate API keys regularly" -ForegroundColor Gray
Write-Host "  - Use different keys for dev and production" -ForegroundColor Gray
Write-Host "  - Monitor API usage for unusual activity" -ForegroundColor Gray
