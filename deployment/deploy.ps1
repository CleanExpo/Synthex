# SYNTHEX Deployment Script for Windows
# Safe deployment with rollback capabilities

param(
    [string]$Environment = "staging",
    [switch]$EnableFeatureFlags = $false
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

# Configuration
$script:RollbackVersion = ""

Write-Success "======================================"
Write-Success "   SYNTHEX Deployment Script"
Write-Success "   Environment: $Environment"
Write-Success "======================================"

# Check prerequisites
function Check-Prerequisites {
    Write-Warning "Checking prerequisites..."
    
    # Check Docker
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker is not installed"
        exit 1
    }
    
    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js is not installed"
        exit 1
    }
    
    Write-Success "✓ All prerequisites met"
}

# Run tests
function Run-Tests {
    Write-Warning "Running tests..."
    
    try {
        # Run unit tests
        npm run test:unit
        
        # Run integration tests if in production
        if ($Environment -eq "production") {
            npm run test:integration
        }
        
        Write-Success "✓ All tests passed"
    }
    catch {
        Write-Error "Tests failed: $_"
        exit 1
    }
}

# Build application
function Build-Application {
    Write-Warning "Building application..."
    
    try {
        # Clean previous build
        npm run clean
        
        # Build based on environment
        if ($Environment -eq "production") {
            npm run build:prod
        }
        else {
            npm run build
        }
        
        Write-Success "✓ Build completed"
    }
    catch {
        Write-Error "Build failed: $_"
        exit 1
    }
}

# Backup current deployment
function Backup-Current {
    Write-Warning "Creating backup..."
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = "backups\$timestamp"
    
    # Create backup directory
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    
    # Backup current deployment
    if (Test-Path "dist") {
        Copy-Item -Path "dist" -Destination "$backupDir\dist" -Recurse
    }
    
    if (Test-Path "public") {
        Copy-Item -Path "public" -Destination "$backupDir\public" -Recurse
    }
    
    # Save version info
    @"
Backup created at $(Get-Date)
Git commit: $(git rev-parse HEAD)
"@ | Out-File "$backupDir\version.txt"
    
    $script:RollbackVersion = $backupDir
    Write-Success "✓ Backup created: $backupDir"
}

# Deploy with Docker
function Deploy-Docker {
    Write-Warning "Deploying with Docker..."
    
    try {
        Set-Location deployment
        
        # Stop existing containers
        docker-compose down
        
        # Build and start new containers
        if ($Environment -eq "production") {
            docker-compose up -d --build
        }
        else {
            docker-compose up -d --build
        }
        
        Set-Location ..
        
        Write-Success "✓ Docker deployment completed"
    }
    catch {
        Write-Error "Docker deployment failed: $_"
        Rollback-Deployment
        exit 1
    }
}

# Verify deployment
function Verify-Deployment {
    Write-Warning "Verifying deployment..."
    
    # Wait for services to start
    Start-Sleep -Seconds 10
    
    try {
        # Check health endpoints
        $webHealth = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing
        if ($webHealth.StatusCode -eq 200) {
            Write-Success "✓ Web server is healthy"
        }
        else {
            throw "Web server health check failed"
        }
        
        $apiHealth = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
        if ($apiHealth.StatusCode -eq 200) {
            Write-Success "✓ API server is healthy"
        }
        else {
            throw "API server health check failed"
        }
        
        Write-Success "✓ Deployment verified"
    }
    catch {
        Write-Error "Health check failed: $_"
        Rollback-Deployment
        exit 1
    }
}

# Rollback deployment
function Rollback-Deployment {
    Write-Error "Rolling back deployment..."
    
    if ($script:RollbackVersion -and (Test-Path $script:RollbackVersion)) {
        # Restore from backup
        Remove-Item -Path "dist", "public" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "$script:RollbackVersion\dist" -Destination "dist" -Recurse
        Copy-Item -Path "$script:RollbackVersion\public" -Destination "public" -Recurse
        
        # Restart services
        Set-Location deployment
        docker-compose restart
        Set-Location ..
        
        Write-Success "✓ Rollback completed"
    }
    else {
        Write-Error "No backup available for rollback"
    }
}

# Enable feature flags
function Enable-FeatureFlags {
    Write-Warning "Configuring feature flags..."
    
    try {
        if ($Environment -eq "staging") {
            # Enable 10% rollout for staging
            node deployment\rollout-script.js --percentage 10
        }
        elseif ($Environment -eq "production") {
            # Gradual rollout for production
            node deployment\rollout-script.js --gradual
        }
        
        Write-Success "✓ Feature flags configured"
    }
    catch {
        Write-Error "Feature flag configuration failed: $_"
    }
}

# Main deployment flow
function Main {
    Write-Warning "Starting deployment process..."
    
    try {
        # Step 1: Check prerequisites
        Check-Prerequisites
        
        # Step 2: Run tests
        Run-Tests
        
        # Step 3: Build application
        Build-Application
        
        # Step 4: Backup current deployment
        Backup-Current
        
        # Step 5: Deploy with Docker
        Deploy-Docker
        
        # Step 6: Configure feature flags
        if ($EnableFeatureFlags) {
            Enable-FeatureFlags
        }
        
        # Step 7: Verify deployment
        Verify-Deployment
        
        Write-Success "======================================"
        Write-Success "   Deployment Successful!"
        Write-Success "   Environment: $Environment"
        Write-Success "   Rollback available: $script:RollbackVersion"
        Write-Success "======================================"
    }
    catch {
        Write-Error "Deployment failed: $_"
        Rollback-Deployment
        exit 1
    }
}

# Run main function
Main