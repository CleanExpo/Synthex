# SYNTHEX Build Orchestrator Agent Launcher
# PowerShell script to launch the autonomous build agent

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                              ║" -ForegroundColor Cyan
Write-Host "║           🏗️  SYNTHEX BUILD ORCHESTRATOR AGENT  🏗️          ║" -ForegroundColor Cyan
Write-Host "║                                                              ║" -ForegroundColor Cyan
Write-Host "║       Autonomous Marketing Application Builder              ║" -ForegroundColor Cyan
Write-Host "║                                                              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    Write-Host "✓ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "  Please install Node.js from https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Navigate to the script directory
Set-Location $PSScriptRoot

# Check and install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
}

# Compile TypeScript files
Write-Host "🔨 Compiling TypeScript files..." -ForegroundColor Yellow
$compileResult = npx tsc src/agents/launch-build-agent.ts --outDir dist/agents --esModuleInterop --resolveJsonModule --skipLibCheck 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ TypeScript compilation successful" -ForegroundColor Green
} else {
    Write-Host "⚠ TypeScript compilation warnings:" -ForegroundColor Yellow
    Write-Host $compileResult -ForegroundColor Gray
}

Write-Host ""
Write-Host "🚀 Launching Build Orchestrator Agent..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

# Run the build agent
node dist/agents/launch-build-agent.js

# Keep window open on exit
Read-Host "`nPress Enter to exit"