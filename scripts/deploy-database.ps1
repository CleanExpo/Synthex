#Requires -Version 5.1
<#
.SYNOPSIS
    SYNTHEX Database Deployment Script

.DESCRIPTION
    Deploys the SYNTHEX database schema using either:
    - Supabase migrations (recommended for production)
    - Step-by-step schema files (for development/testing)
    - Complete schema file (for fresh installs)

.PARAMETER Mode
    Deployment mode: 'migrations', 'steps', 'complete', or 'remote'

.PARAMETER Reset
    If specified, resets the database before deployment (DESTRUCTIVE)

.PARAMETER DryRun
    If specified, shows what would be executed without running

.EXAMPLE
    .\deploy-database.ps1 -Mode migrations
    .\deploy-database.ps1 -Mode steps -Reset
    .\deploy-database.ps1 -Mode remote -ConnectionString "postgresql://..."
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('migrations', 'steps', 'complete', 'remote', 'check')]
    [string]$Mode = 'check',

    [Parameter(Mandatory=$false)]
    [switch]$Reset,

    [Parameter(Mandatory=$false)]
    [switch]$DryRun,

    [Parameter(Mandatory=$false)]
    [string]$ConnectionString,

    [Parameter(Mandatory=$false)]
    [switch]$SkipSampleData,

    [Parameter(Mandatory=$false)]
    [string]$SupabaseBin = ""
)

# =============================================================================
# Configuration
# =============================================================================

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$SupabaseDir = Join-Path $ProjectRoot "supabase"
$script:SupabasePath = "supabase"  # Will be updated if found elsewhere

# Output functions
function Write-Success { param($msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "[..] $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "[!!] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[XX] $msg" -ForegroundColor Red }
function Write-Step { param($msg) Write-Host "`n==> $msg" -ForegroundColor Magenta }

# =============================================================================
# File Definitions
# =============================================================================

$MigrationFiles = @(
    "20250115000001_complete_schema.sql",
    "20250115000002_create_user_integrations.sql",
    "20250115000003_unified_schema.sql",
    "20250115000004_create_integration_logs.sql",
    "20250115000005_create_user_profiles.sql",
    "20250115000006_create_content_posts.sql",
    "20250115000007_create_system_backups.sql",
    "20250115000008_create_notifications.sql",
    "20250115000009_create_user_tables.sql"
)

$StepFiles = @(
    "schema-step1-tables.sql",
    "schema-step2-rls.sql",
    "schema-step3-advanced-features.sql",
    "schema-step4-realtime-automation.sql"
)

$SampleDataFile = "schema-step5-sample-data-safe.sql"
$CompleteSchemaFile = "complete-schema.sql"

# =============================================================================
# Prerequisite Checks
# =============================================================================

function Test-Prerequisites {
    Write-Step "Checking prerequisites..."

    $errors = @()

    # Check Supabase CLI
    $supabaseFound = $false
    $userProfile = [Environment]::GetFolderPath('UserProfile')

    # Build list of paths to try
    if ($SupabaseBin -ne "") {
        $supabasePaths = @($SupabaseBin)
    } else {
        $supabasePaths = @(
            (Join-Path $userProfile "scoop\shims\supabase.exe"),
            (Join-Path $userProfile ".supabase\bin\supabase.exe"),
            (Join-Path $env:LOCALAPPDATA "supabase\bin\supabase.exe"),
            "C:\Program Files\Supabase\supabase.exe"
        )
    }

    foreach ($path in $supabasePaths) {
        if (Test-Path $path -ErrorAction SilentlyContinue) {
            $output = & "$path" --version 2>&1 | Select-Object -First 1
            if ($output -match "\d+\.\d+") {
                Write-Success "Supabase CLI: $output"
                $supabaseFound = $true
                $script:SupabasePath = $path
                break
            }
        }
    }

    if (-not $supabaseFound) {
        Write-Warn "Supabase CLI not auto-detected."
        Write-Info "Try: .\deploy-database.ps1 -SupabaseBin 'C:\path\to\supabase.exe'"
        $errors += "Supabase CLI not found. Install: https://supabase.com/docs/guides/cli"
    }

    # Check Docker (for local mode)
    if ($Mode -ne 'remote') {
        try {
            $dockerVersion = & docker --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Docker: $dockerVersion"

                # Check if Docker is running
                $dockerInfo = & docker info 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Docker is running"
                } else {
                    $errors += "Docker is installed but not running. Please start Docker Desktop."
                }
            } else {
                $errors += "Docker not found. Required for local Supabase."
            }
        } catch {
            $errors += "Docker not found. Required for local Supabase."
        }
    }

    # Check psql (for remote mode)
    if ($Mode -eq 'remote') {
        try {
            $psqlVersion = & psql --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "psql: $psqlVersion"
            } else {
                $errors += "psql not found. Required for remote deployment."
            }
        } catch {
            $errors += "psql not found. Required for remote deployment."
        }
    }

    # Check SQL files exist
    $missingFiles = @()
    foreach ($file in $MigrationFiles) {
        $path = Join-Path $SupabaseDir "migrations\$file"
        if (-not (Test-Path $path)) {
            $missingFiles += $file
        }
    }

    if ($missingFiles.Count -gt 0) {
        $errors += "Missing migration files: $($missingFiles -join ', ')"
    } else {
        Write-Success "All migration files present ($($MigrationFiles.Count) files)"
    }

    # Check step files
    $missingSteps = @()
    foreach ($file in $StepFiles) {
        $path = Join-Path $SupabaseDir $file
        if (-not (Test-Path $path)) {
            $missingSteps += $file
        }
    }

    if ($missingSteps.Count -gt 0) {
        Write-Warn "Missing step files: $($missingSteps -join ', ')"
    } else {
        Write-Success "All step files present ($($StepFiles.Count) files)"
    }

    if ($errors.Count -gt 0) {
        Write-Host ""
        foreach ($error in $errors) {
            Write-Err $error
        }
        return $false
    }

    return $true
}

# =============================================================================
# Supabase Local Management
# =============================================================================

function Start-SupabaseLocal {
    Write-Step "Starting Supabase local..."

    if ($DryRun) {
        Write-Info "[DRY RUN] Would check supabase status"
        Write-Info "[DRY RUN] Would start supabase if not running"
        return $true
    }

    Push-Location $ProjectRoot
    try {
        $status = & $script:SupabasePath status 2>&1
        if ($status -match "DB URL") {
            Write-Success "Supabase is already running"
            return $true
        }

        Write-Info "Starting Supabase (this may take a minute)..."
        & $script:SupabasePath start

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Supabase started successfully"
            return $true
        } else {
            Write-Err "Failed to start Supabase"
            return $false
        }
    } finally {
        Pop-Location
    }
}

function Get-SupabaseDbUrl {
    Push-Location $ProjectRoot
    try {
        $status = & $script:SupabasePath status --output json 2>&1 | ConvertFrom-Json
        return $status.DB_URL
    } catch {
        # Fallback to default local URL
        return "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    } finally {
        Pop-Location
    }
}

# =============================================================================
# SQL Execution
# =============================================================================

function Invoke-SqlFile {
    param(
        [string]$FilePath,
        [string]$DbUrl,
        [string]$Description
    )

    if (-not (Test-Path $FilePath)) {
        Write-Err "File not found: $FilePath"
        return $false
    }

    $fileName = Split-Path -Leaf $FilePath
    Write-Info "Executing: $fileName"

    if ($DryRun) {
        Write-Info "[DRY RUN] Would execute: $FilePath"
        return $true
    }

    try {
        # Use psql to execute the SQL file
        $result = & psql $DbUrl -f $FilePath -v ON_ERROR_STOP=1 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Success "$fileName completed"
            return $true
        } else {
            Write-Err "Failed: $fileName"
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Err "Exception executing $fileName - $_"
        return $false
    }
}

function Invoke-SupabaseMigrations {
    Write-Step "Running Supabase migrations..."

    Push-Location $ProjectRoot
    try {
        if ($Reset) {
            Write-Warn "Resetting database (this will delete all data)..."
            if (-not $DryRun) {
                & $script:SupabasePath db reset --no-seed
                if ($LASTEXITCODE -ne 0) {
                    Write-Err "Database reset failed"
                    return $false
                }
                Write-Success "Database reset complete"
            } else {
                Write-Info "[DRY RUN] Would run: supabase db reset --no-seed"
            }
        } else {
            Write-Info "Pushing migrations..."
            if (-not $DryRun) {
                & $script:SupabasePath db push
                if ($LASTEXITCODE -ne 0) {
                    Write-Err "Migration push failed"
                    return $false
                }
                Write-Success "Migrations applied"
            } else {
                Write-Info "[DRY RUN] Would run: supabase db push"
            }
        }

        return $true
    } finally {
        Pop-Location
    }
}

# =============================================================================
# Deployment Modes
# =============================================================================

function Deploy-WithMigrations {
    Write-Step "Deploying with Supabase migrations..."

    if (-not (Start-SupabaseLocal)) {
        return $false
    }

    if (-not (Invoke-SupabaseMigrations)) {
        return $false
    }

    # Optionally run sample data
    if (-not $SkipSampleData) {
        $dbUrl = Get-SupabaseDbUrl
        $sampleDataPath = Join-Path $SupabaseDir $SampleDataFile
        if (Test-Path $sampleDataPath) {
            Write-Step "Loading sample data..."
            Invoke-SqlFile -FilePath $sampleDataPath -DbUrl $dbUrl -Description "Sample Data"
        }
    }

    return $true
}

function Deploy-WithSteps {
    Write-Step "Deploying with step-by-step schema files..."

    if (-not (Start-SupabaseLocal)) {
        return $false
    }

    $dbUrl = Get-SupabaseDbUrl
    Write-Info "Database URL: $($dbUrl.Substring(0, 30))..."

    if ($Reset) {
        Write-Warn "Resetting database..."
        if (-not $DryRun) {
            Push-Location $ProjectRoot
            & $script:SupabasePath db reset --no-seed
            Pop-Location
        }
    }

    # Execute each step file in order
    $stepNumber = 1
    foreach ($file in $StepFiles) {
        $filePath = Join-Path $SupabaseDir $file
        Write-Step "Step $stepNumber of $($StepFiles.Count) - $file"

        if (-not (Invoke-SqlFile -FilePath $filePath -DbUrl $dbUrl -Description "Step $stepNumber")) {
            Write-Err "Deployment failed at step $stepNumber"
            return $false
        }
        $stepNumber++
    }

    # Load sample data unless skipped
    if (-not $SkipSampleData) {
        $sampleDataPath = Join-Path $SupabaseDir $SampleDataFile
        if (Test-Path $sampleDataPath) {
            Write-Step "Step $stepNumber - Loading sample data..."
            Invoke-SqlFile -FilePath $sampleDataPath -DbUrl $dbUrl -Description "Sample Data"
        }
    }

    return $true
}

function Deploy-Complete {
    Write-Step "Deploying complete schema..."

    if (-not (Start-SupabaseLocal)) {
        return $false
    }

    $dbUrl = Get-SupabaseDbUrl
    $schemaPath = Join-Path $SupabaseDir $CompleteSchemaFile

    if ($Reset) {
        Write-Warn "Resetting database..."
        if (-not $DryRun) {
            Push-Location $ProjectRoot
            & $script:SupabasePath db reset --no-seed
            Pop-Location
        }
    }

    return Invoke-SqlFile -FilePath $schemaPath -DbUrl $dbUrl -Description "Complete Schema"
}

function Deploy-Remote {
    Write-Step "Deploying to remote database..."

    if ([string]::IsNullOrEmpty($ConnectionString)) {
        Write-Err "Connection string required for remote deployment"
        Write-Info "Usage: .\deploy-database.ps1 -Mode remote -ConnectionString 'postgresql://...'"
        return $false
    }

    Write-Warn "Deploying to REMOTE database. This is IRREVERSIBLE."
    $confirm = Read-Host "Type 'DEPLOY' to confirm"
    if ($confirm -ne 'DEPLOY') {
        Write-Info "Deployment cancelled"
        return $false
    }

    # For remote, use step files for safety
    $stepNumber = 1
    foreach ($file in $StepFiles) {
        $filePath = Join-Path $SupabaseDir $file
        Write-Step "Step $stepNumber of $($StepFiles.Count) - $file"

        if (-not (Invoke-SqlFile -FilePath $filePath -DbUrl $ConnectionString -Description "Step $stepNumber")) {
            Write-Err "Deployment failed at step $stepNumber"
            return $false
        }
        $stepNumber++
    }

    return $true
}

# =============================================================================
# Main Execution
# =============================================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "         SYNTHEX Database Deployment Script                    " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Mode: $Mode" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Run prerequisite checks
if (-not (Test-Prerequisites)) {
    Write-Host ""
    Write-Err "Prerequisites not met. Please fix the issues above."
    exit 1
}

# Execute based on mode
$success = $false

switch ($Mode) {
    'check' {
        Write-Success "All prerequisites passed!"
        Write-Host ""
        Write-Info "Available deployment modes:"
        Write-Host "  -Mode migrations  : Use Supabase migration system (recommended)"
        Write-Host "  -Mode steps       : Run schema step files in order"
        Write-Host "  -Mode complete    : Run single complete schema file"
        Write-Host "  -Mode remote      : Deploy to remote database"
        Write-Host ""
        Write-Info "Options:"
        Write-Host "  -Reset            : Reset database before deployment (DESTRUCTIVE)"
        Write-Host "  -DryRun           : Show what would be executed"
        Write-Host "  -SkipSampleData   : Skip loading sample/test data"
        Write-Host ""
        Write-Info "Examples:"
        Write-Host "  .\deploy-database.ps1 -Mode migrations"
        Write-Host "  .\deploy-database.ps1 -Mode steps -Reset"
        Write-Host "  .\deploy-database.ps1 -Mode steps -DryRun"
        $success = $true
    }
    'migrations' {
        $success = Deploy-WithMigrations
    }
    'steps' {
        $success = Deploy-WithSteps
    }
    'complete' {
        $success = Deploy-Complete
    }
    'remote' {
        $success = Deploy-Remote
    }
}

# Final status
Write-Host ""
if ($success) {
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "                  DEPLOYMENT SUCCESSFUL                        " -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green

    if ($Mode -ne 'check' -and $Mode -ne 'remote') {
        Write-Host ""
        Write-Info "Supabase Studio: http://127.0.0.1:54323"
        Write-Info "Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    }

    exit 0
} else {
    Write-Host "================================================================" -ForegroundColor Red
    Write-Host "                   DEPLOYMENT FAILED                           " -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Red
    exit 1
}
