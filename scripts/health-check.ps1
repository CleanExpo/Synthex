# Synthex System Health Check
# Validates the full stack: environment, database, TypeScript, tests, build
# Adapted from NodeJS-Starter-V1 for Synthex (npm, Next.js 15, Prisma, Windows 11)
#
# Usage:
#   .\scripts\health-check.ps1
#   .\scripts\health-check.ps1 -Verbose
#   .\scripts\health-check.ps1 -Quick        # Skip build and E2E
#   .\scripts\health-check.ps1 -SkipTests    # Skip all test suites

param(
    [switch]$Verbose,
    [switch]$Quick,
    [switch]$SkipTests
)

$ErrorActionPreference = "Continue"
$startTime = Get-Date

# Statistics tracking
$script:totalChecks   = 0
$script:passedChecks  = 0
$script:failedChecks  = 0
$script:warningChecks = 0
$script:errors        = @()
$script:warnings      = @()

# ============================================================================
# Output Helpers
# ============================================================================

function Write-Header {
    param([string]$Text)
    Write-Host "`n$("=" * 80)" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "$("=" * 80)`n" -ForegroundColor Cyan
}

function Write-Phase {
    param([string]$Phase, [int]$Current, [int]$Total)
    Write-Host "`n[Phase $Current/$Total] $Phase" -ForegroundColor Yellow
    Write-Host "$("-" * 80)" -ForegroundColor Gray
}

function Write-Check {
    param(
        [string]$Message,
        [bool]$Success,
        [string]$Details = "",
        [switch]$IsWarning
    )

    $script:totalChecks++

    if ($IsWarning) {
        $icon  = "[WARN]"
        $color = "Yellow"
        $script:warningChecks++
        if ($Details) { $script:warnings += "$Message - $Details" }
    }
    elseif ($Success) {
        $icon  = "[PASS]"
        $color = "Green"
        $script:passedChecks++
    }
    else {
        $icon  = "[FAIL]"
        $color = "Red"
        $script:failedChecks++
        if ($Details) { $script:errors += "$Message - $Details" }
    }

    Write-Host "  $icon $Message" -ForegroundColor $color
    if ($Details -and $Verbose) {
        Write-Host "     $Details" -ForegroundColor Gray
    }
}

function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch { return $false }
}

function Get-VersionString {
    param([string]$Command, [string]$Arg = "--version")
    try {
        $output = & $Command $Arg 2>&1 | Select-Object -First 1
        return $output.ToString().Trim()
    }
    catch { return "unknown" }
}

# ============================================================================
Write-Header "SYNTHEX SYSTEM HEALTH CHECK"
# ============================================================================

if ($Quick)     { Write-Host "  Running in QUICK mode (skipping build and E2E)" -ForegroundColor Cyan }
if ($SkipTests) { Write-Host "  Running in SKIP TESTS mode" -ForegroundColor Cyan }
if ($Verbose)   { Write-Host "  Running in VERBOSE mode" -ForegroundColor Cyan }

# ============================================================================
# PHASE 1: Prerequisites & Environment
# ============================================================================

Write-Phase "Prerequisites and Environment" 1 5

# Node.js — Synthex requires Node 22
if (Test-Command "node") {
    $nodeVersion = Get-VersionString "node" "-v"
    $versionNum  = [int]($nodeVersion -replace '[^0-9].*', '')
    if ($versionNum -ge 22) {
        Write-Check "Node.js $nodeVersion" $true
    }
    elseif ($versionNum -ge 20) {
        Write-Check "Node.js $nodeVersion" $false "Synthex requires Node 22+ (found $nodeVersion)" -IsWarning
    }
    else {
        Write-Check "Node.js $nodeVersion" $false "Requires Node 22 or higher"
    }
}
else {
    Write-Check "Node.js" $false "Not installed"
}

# npm
if (Test-Command "npm") {
    $npmVersion = Get-VersionString "npm"
    Write-Check "npm $npmVersion" $true
}
else {
    Write-Check "npm" $false "Not installed"
}

# Git
if (Test-Command "git") {
    $gitVersion = Get-VersionString "git"
    Write-Check "git $gitVersion" $true
}
else {
    Write-Check "git" $false "Not installed"
}

# Claude CLI (optional — used by ralph.ps1)
if (Test-Command "claude") {
    Write-Check "Claude CLI found" $true
}
else {
    Write-Check "Claude CLI" $false "Not installed (optional — needed for ralph.ps1)" -IsWarning
}

# node_modules
if (Test-Path "node_modules") {
    Write-Check "node_modules installed" $true
}
else {
    Write-Check "node_modules" $false "Not installed — run: npm install"
}

# Prisma client
if (Test-Path "node_modules\@prisma\client") {
    Write-Check "Prisma client present" $true
}
else {
    Write-Check "Prisma client" $false "Missing — run: npx prisma generate" -IsWarning
}

# Key project files
$projectFiles = @("package.json", "tsconfig.json", "prisma\schema.prisma")
foreach ($file in $projectFiles) {
    if (Test-Path $file) {
        Write-Check "$file present" $true
    }
    else {
        Write-Check "$file" $false "File missing"
    }
}

# Environment variables — read .env.example as the source of truth
Write-Host "`n  Checking environment variables..." -ForegroundColor Gray

$envConfigured = 0
$envTotal      = 0
$envMissing    = @()

if (Test-Path ".env.example") {
    $envLines = Get-Content ".env.example"
    $envVars  = $envLines | Where-Object { $_ -match '^[A-Z_]+=' -and $_ -notmatch '^#' } |
                ForEach-Object { ($_ -split '=')[0] }

    $envTotal = @($envVars).Count

    foreach ($var in $envVars) {
        if ([string]::IsNullOrEmpty($var)) { continue }

        $found = $false

        # Process environment
        if ([System.Environment]::GetEnvironmentVariable($var)) { $found = $true }

        # .env.local
        if (-not $found -and (Test-Path ".env.local")) {
            $content = Get-Content ".env.local" -Raw
            if ($content -match "^$var=.+") { $found = $true }
        }

        # .env
        if (-not $found -and (Test-Path ".env")) {
            $content = Get-Content ".env" -Raw
            if ($content -match "^$var=.+") { $found = $true }
        }

        if ($found) { $envConfigured++ }
        else        { $envMissing += $var }
    }

    if ($envConfigured -eq $envTotal) {
        Write-Check "Environment variables ($envConfigured/$envTotal)" $true
    }
    elseif ($envConfigured -gt 0) {
        Write-Check "Environment variables ($envConfigured/$envTotal)" $false "Missing: $($envMissing -join ', ')" -IsWarning
    }
    else {
        Write-Check "Environment variables" $false "None configured — copy .env.example to .env.local"
    }
}
else {
    Write-Check ".env.example" $false "File missing — cannot validate env vars" -IsWarning
}

# Abort if hard prerequisites are missing
if ($script:failedChecks -gt 0 -and (-not (Test-Path "node_modules"))) {
    Write-Host "`n[STOP] Critical prerequisites failed. Run 'npm install' first." -ForegroundColor Red
    exit 1
}

# ============================================================================
# PHASE 2: Database Health
# ============================================================================

Write-Phase "Database Health" 2 5

# Validate Prisma schema
Write-Host "  Validating Prisma schema..." -ForegroundColor Gray
try {
    if ($Verbose) {
        npx prisma validate
    }
    else {
        npx prisma validate 2>&1 | Out-Null
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Check "Prisma schema valid" $true
    }
    else {
        Write-Check "Prisma schema" $false "Validation failed — run: npx prisma validate"
    }
}
catch {
    Write-Check "Prisma schema" $false "Error: $_"
}

# Check database connection
Write-Host "  Checking database connection..." -ForegroundColor Gray
try {
    if ($Verbose) {
        node scripts/verify-db-connection.mjs
    }
    else {
        node scripts/verify-db-connection.mjs 2>&1 | Out-Null
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Check "Database connection" $true
    }
    else {
        Write-Check "Database connection" $false "Cannot connect — check DATABASE_URL in .env.local" -IsWarning
    }
}
catch {
    Write-Check "Database connection" $false "Script not found or error" -IsWarning
}

# ============================================================================
# PHASE 3: Code Quality
# ============================================================================

Write-Phase "Code Quality" 3 5

# TypeScript type check
Write-Host "  Running type check..." -ForegroundColor Gray
try {
    if ($Verbose) {
        npm run type-check
    }
    else {
        npm run type-check 2>&1 | Out-Null
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Check "TypeScript compilation" $true
    }
    else {
        Write-Check "TypeScript compilation" $false "Type errors found — run: npm run type-check"
    }
}
catch {
    Write-Check "TypeScript compilation" $false "Error: $_"
}

# ESLint
Write-Host "  Running lint..." -ForegroundColor Gray
try {
    if ($Verbose) {
        npm run lint
    }
    else {
        npm run lint 2>&1 | Out-Null
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Check "ESLint" $true
    }
    else {
        Write-Check "ESLint" $false "Lint errors found — run: npm run lint"
    }
}
catch {
    Write-Check "ESLint" $false "Error: $_"
}

# ============================================================================
# PHASE 4: Tests
# ============================================================================

Write-Phase "Tests" 4 5

if (-not $SkipTests) {
    # Unit tests
    Write-Host "  Running unit tests..." -ForegroundColor Gray
    try {
        if ($Verbose) {
            npm test
        }
        else {
            $testOutput = npm test 2>&1
            $testSummary = ($testOutput | Select-String "Tests:" | Select-Object -Last 1).ToString()
        }

        if ($LASTEXITCODE -eq 0) {
            Write-Check "Unit tests" $true $testSummary
        }
        else {
            Write-Check "Unit tests" $false "Some tests failed — run: npm test"
        }
    }
    catch {
        Write-Check "Unit tests" $false "Error: $_"
    }

    # E2E tests (skip in Quick mode)
    if (-not $Quick) {
        Write-Host "`n  Running E2E tests (requires dev server)..." -ForegroundColor Gray
        try {
            if ($Verbose) {
                npm run e2e
            }
            else {
                $e2eOutput = npm run e2e 2>&1
                $e2eSummary = ($e2eOutput | Select-String "passed" | Select-Object -Last 1).ToString()
            }

            if ($LASTEXITCODE -eq 0) {
                Write-Check "E2E tests" $true $e2eSummary
            }
            else {
                Write-Check "E2E tests" $false "Some E2E tests failed or dev server not running" -IsWarning
            }
        }
        catch {
            Write-Check "E2E tests" $false "Error: $_" -IsWarning
        }
    }
    else {
        Write-Check "E2E tests" $true "Skipped (Quick mode)" -IsWarning
    }
}
else {
    Write-Check "Tests" $true "Skipped (-SkipTests flag)" -IsWarning
}

# ============================================================================
# PHASE 5: Build
# ============================================================================

Write-Phase "Build" 5 5

if (-not $Quick) {
    Write-Host "  Building for production..." -ForegroundColor Gray
    try {
        if ($Verbose) {
            npm run build
        }
        else {
            npm run build 2>&1 | Out-Null
        }

        if ($LASTEXITCODE -eq 0) {
            Write-Check "Production build" $true
        }
        else {
            Write-Check "Production build" $false "Build failed — run: npm run build"
        }
    }
    catch {
        Write-Check "Production build" $false "Error: $_"
    }
}
else {
    Write-Check "Production build" $true "Skipped (Quick mode)" -IsWarning
}

# ============================================================================
# Summary Report
# ============================================================================

$executionTime    = (Get-Date) - $startTime
$executionTimeStr = "{0}m {1}s" -f [int]$executionTime.TotalMinutes, $executionTime.Seconds

Write-Header "SYNTHEX HEALTH CHECK RESULTS"

$overallStatus = "HEALTHY"
$statusColor   = "Green"
$statusLabel   = "[PASS]"

if ($script:failedChecks -gt 0) {
    $overallStatus = "UNHEALTHY"
    $statusColor   = "Red"
    $statusLabel   = "[FAIL]"
}
elseif ($script:warningChecks -gt 0) {
    $overallStatus = "DEGRADED"
    $statusColor   = "Yellow"
    $statusLabel   = "[WARN]"
}

Write-Host "  $statusLabel $overallStatus" -ForegroundColor $statusColor
Write-Host ""
Write-Host "  Total Checks:  $script:totalChecks"  -ForegroundColor White
Write-Host "  Passed:        $script:passedChecks"  -ForegroundColor Green
Write-Host "  Failed:        $script:failedChecks"  -ForegroundColor $(if ($script:failedChecks -gt 0) { "Red" } else { "Gray" })
Write-Host "  Warnings:      $script:warningChecks" -ForegroundColor $(if ($script:warningChecks -gt 0) { "Yellow" } else { "Gray" })
Write-Host ""
Write-Host "  Duration:      $executionTimeStr" -ForegroundColor White
Write-Host ""

if ($script:errors.Count -gt 0) {
    Write-Host "  Errors:" -ForegroundColor Red
    foreach ($err in $script:errors) {
        Write-Host "     - $err" -ForegroundColor Red
    }
    Write-Host ""
}

if ($script:warnings.Count -gt 0) {
    Write-Host "  Warnings:" -ForegroundColor Yellow
    foreach ($warn in $script:warnings) {
        Write-Host "     - $warn" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($script:failedChecks -gt 0) {
    Write-Host "  Suggested Actions:" -ForegroundColor Cyan
    Write-Host "     1. Fix errors listed above" -ForegroundColor Gray
    Write-Host "     2. Run with -Verbose for detailed output" -ForegroundColor Gray
    Write-Host "     3. Check individual services (DATABASE_URL, Prisma schema)" -ForegroundColor Gray
}
elseif ($script:warningChecks -gt 0) {
    Write-Host "  System Status:" -ForegroundColor Cyan
    Write-Host "     Functional with warnings — review above for improvements" -ForegroundColor Gray
}
else {
    Write-Host "  System Status:" -ForegroundColor Cyan
    Write-Host "     All systems operational!" -ForegroundColor Green
    Write-Host "     Ready for: Development, Testing, Deployment" -ForegroundColor Green
}

Write-Host ""
Write-Host "$("=" * 80)" -ForegroundColor Cyan
Write-Host ""

if ($script:failedChecks -gt 0) { exit 1 } else { exit 0 }
