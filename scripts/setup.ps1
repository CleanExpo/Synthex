# =============================================================================
# Synthex Developer Setup Script (Windows PowerShell)
# =============================================================================
$ErrorActionPreference = "Stop"

$STEP = 0
$TOTAL = 7

function Step($msg) {
    $script:STEP++
    Write-Host ""
    Write-Host "[$script:STEP/$TOTAL] $msg" -ForegroundColor Cyan
    Write-Host "────────────────────────────────────────" -ForegroundColor DarkGray
}

function Ok($msg)   { Write-Host "  + $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "  x $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "     Synthex Development Setup          " -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Check prerequisites
Step "Checking prerequisites"

try {
    $nodeVer = (node -v) -replace 'v', ''
    $nodeMajor = [int]($nodeVer.Split('.')[0])
    if ($nodeMajor -lt 20) { Fail "Node.js v20+ required. Current: v$nodeVer" }
    Ok "Node.js v$nodeVer"
} catch { Fail "Node.js not found. Install from https://nodejs.org (v20+)" }

try {
    $npmVer = npm -v
    Ok "npm $npmVer"
} catch { Fail "npm not found" }

try {
    $gitVer = git --version
    Ok $gitVer
} catch { Fail "Git not found. Install from https://git-scm.com" }

# Step 2: Install dependencies
Step "Installing dependencies"
try {
    npm install --legacy-peer-deps
    Ok "Dependencies installed"
} catch { Fail "npm install failed" }

# Step 3: Configure environment
Step "Configuring environment"
if (!(Test-Path ".env") -and !(Test-Path ".env.local")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env.local"
        Warn ".env.local created from .env.example - fill in your API keys"
    } else {
        Warn "No .env.example found - create .env.local manually"
    }
} else {
    Ok "Environment file already exists"
}

# Step 4: Set up Git hooks
Step "Installing Git hooks"
try {
    npm run prepare 2>$null
    Ok "Husky hooks installed"
} catch { Warn "Husky install skipped (not in a Git repository)" }

# Step 5: Generate Prisma client
Step "Generating Prisma client"
try {
    $env:PRISMA_GENERATE_SKIP_AUTOINSTALL = "true"
    npx --no prisma generate 2>$null
    Ok "Prisma client generated"
} catch { Warn "Prisma generate failed - run manually: npx prisma generate" }

# Step 6: Verify TypeScript
Step "Checking TypeScript configuration"
try {
    $errors = npx tsc --noEmit --pretty false 2>&1 | Where-Object { $_ -match "error TS" }
    if ($errors.Count -eq 0) {
        Ok "TypeScript: no errors"
    } else {
        Warn "TypeScript has pre-existing errors - run 'npm run type-check' for details"
    }
} catch { Warn "TypeScript check skipped" }

# Step 7: Final summary
Step "Setup complete"
Write-Host ""
Write-Host "✓ Synthex development environment ready!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Fill in API keys in .env.local (see .env.example for guidance)"
Write-Host "  2. Run: npm run dev"
Write-Host "  3. Open: http://localhost:3000"
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "  npm run dev           - Start development server"
Write-Host "  npm run type-check    - Check TypeScript"
Write-Host "  npm run lint          - Run ESLint"
Write-Host "  npm test              - Run unit tests"
Write-Host "  npm run e2e           - Run E2E tests"
Write-Host "  npm run verify        - Health check all services"
Write-Host ""
