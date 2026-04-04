# =============================================================================
# Synthex Environment Verification Script (Windows PowerShell)
# =============================================================================

$PASS = 0
$FAIL = 0
$WARN = 0

function Ok($msg)   { $script:PASS++; Write-Host "  + $msg" -ForegroundColor Green }
function Fail($msg) { $script:FAIL++; Write-Host "  x $msg" -ForegroundColor Red }
function Warn($msg) { $script:WARN++; Write-Host "  ! $msg" -ForegroundColor Yellow }
function Section($msg) { Write-Host ""; Write-Host "-- $msg" -ForegroundColor Cyan }

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "     Synthex Environment Verification   " -ForegroundColor Cyan
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan

# Prerequisites
Section "Prerequisites"

try { $null = node -v; Ok "Node.js $(node -v)" } catch { Fail "Node.js not installed" }
try { $null = npm -v; Ok "npm $(npm -v)" } catch { Fail "npm not installed" }
try { $null = git --version; Ok "Git installed" } catch { Fail "Git not installed" }

# Project files
Section "Project Files"

if (Test-Path "package.json")           { Ok "package.json" }         else { Fail "package.json missing" }
if (Test-Path "tsconfig.json")          { Ok "tsconfig.json" }        else { Fail "tsconfig.json missing" }
if (Test-Path "prisma\schema.prisma")   { Ok "prisma\schema.prisma" } else { Fail "prisma\schema.prisma missing" }
if (Test-Path "node_modules")           { Ok "node_modules installed" } else { Fail "node_modules missing - run npm install" }
if (Test-Path "node_modules\@prisma\client") { Ok "Prisma client package present" } else { Fail "Prisma client missing - run npm install" }

# Environment variables
Section "Environment Variables"

$envFile = $null
if (Test-Path ".env.local") { $envFile = ".env.local" }
elseif (Test-Path ".env")   { $envFile = ".env" }

if (-not $envFile) {
    Fail "No .env or .env.local file — run: Copy-Item .env.example .env.local"
} else {
    Ok "Environment file: $envFile"
    $envContent = Get-Content $envFile -Raw

    foreach ($key in @("DATABASE_URL", "DIRECT_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "JWT_SECRET", "NEXTAUTH_SECRET")) {
        if ($envContent -match "^${key}=(.+)$") {
            $val = $Matches[1].Trim('"').Trim("'")
            if ($val -and $val -ne "CHANGE_ME" -and -not $val.StartsWith("your_")) {
                Ok "$key set"
            } else {
                Fail "$key not configured in $envFile"
            }
        } else {
            Fail "$key missing from $envFile"
        }
    }
}

# Prisma
Section "Prisma"

try {
    $env:PRISMA_GENERATE_SKIP_AUTOINSTALL = "true"
    npx --no prisma validate 2>$null
    Ok "Prisma schema valid"
} catch { Fail "Prisma schema validation failed" }

if (Test-Path "node_modules\@prisma\client") { Ok "Prisma client generated" }
else { Fail "Prisma client not generated - run: npx prisma generate" }

# Git hooks
Section "Git Hooks"

if (Test-Path ".husky\pre-commit") { Ok ".husky\pre-commit installed" }
else { Warn ".husky\pre-commit missing - run: npm run prepare" }

# Summary
$totalChecks = $PASS + $FAIL + $WARN
Write-Host ""
Write-Host "════════════════════════════════════════"
Write-Host "  Checks: $totalChecks | Pass: $PASS | Fail: $FAIL | Warn: $WARN"
Write-Host ""

if ($FAIL -gt 0) {
    Write-Host "  x Verification FAILED - fix the issues above" -ForegroundColor Red
    exit 1
} elseif ($WARN -gt 0) {
    Write-Host "  ! Verification passed with warnings" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "  + All checks passed - environment ready" -ForegroundColor Green
    exit 0
}
