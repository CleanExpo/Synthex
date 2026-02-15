# pre-build-validate.ps1
# PreToolUse hook for Bash -- validates build prerequisites
# Exit 0 = allow, Exit 2 = block

param(
    [string]$ToolInput
)

try {
    $input = $ToolInput | ConvertFrom-Json
    $command = $input.command
} catch {
    exit 0
}

if (-not $command) { exit 0 }

# Only validate build-related commands
$buildPatterns = @('npm\s+run\s+build', 'tsc\b', 'vercel\s+build', 'vercel\s+deploy')
$isBuild = $false
foreach ($pattern in $buildPatterns) {
    if ($command -match $pattern) { $isBuild = $true; break }
}

if (-not $isBuild) { exit 0 }

$appDir = "D:\Synthex\Synthex"
$errors = @()

# Check package.json exists
if (-not (Test-Path "$appDir\package.json")) {
    $errors += "package.json not found in $appDir"
}

# Check node_modules exists
if (-not (Test-Path "$appDir\node_modules")) {
    $errors += "node_modules not found -- run 'npm install' first"
}

# Check tsconfig.json exists
if (-not (Test-Path "$appDir\tsconfig.json")) {
    $errors += "tsconfig.json not found in $appDir"
}

# Check for .env or environment variables
if (-not (Test-Path "$appDir\.env") -and -not $env:DATABASE_URL) {
    Write-Warning "No .env file found and DATABASE_URL not set -- build may fail for Prisma"
}

if ($errors.Count -gt 0) {
    Write-Error "BUILD PREFLIGHT FAILED:`n$($errors -join "`n")"
    exit 2
}

Write-Output "Build preflight passed: package.json, node_modules, tsconfig.json verified"
exit 0
