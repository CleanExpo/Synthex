# SYNTHEX Complete System Launcher (PowerShell)
Clear-Host

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║         SYNTHEX - AI-POWERED MARKETING PLATFORM           ║" -ForegroundColor Magenta
Write-Host "║              COMPLETE SYSTEM LAUNCHER v1.0                ║" -ForegroundColor Magenta
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Function to check requirements
function Test-Requirements {
    Write-Host "📋 Checking Requirements..." -ForegroundColor Cyan
    
    $hasNode = Get-Command node -ErrorAction SilentlyContinue
    $hasPython = Get-Command python -ErrorAction SilentlyContinue
    $hasNpm = Get-Command npm -ErrorAction SilentlyContinue
    
    if ($hasNode) {
        Write-Host "  ✓ Node.js installed" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Node.js not found" -ForegroundColor Red
        return $false
    }
    
    if ($hasPython) {
        Write-Host "  ✓ Python installed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Python not found (optional)" -ForegroundColor Yellow
    }
    
    if ($hasNpm) {
        Write-Host "  ✓ NPM installed" -ForegroundColor Green
    } else {
        Write-Host "  ✗ NPM not found" -ForegroundColor Red
        return $false
    }
    
    if (Test-Path ".env") {
        Write-Host "  ✓ Environment file found" -ForegroundColor Green
    } else {
        Write-Host "  ✗ .env file not found" -ForegroundColor Red
        return $false
    }
    
    return $true
}

# Function to install dependencies
function Install-Dependencies {
    if (-not (Test-Path "node_modules")) {
        Write-Host ""
        Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ✗ Failed to install dependencies" -ForegroundColor Red
            return $false
        }
        Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Dependencies already installed" -ForegroundColor Green
    }
    return $true
}

# Function to start services
function Start-Services {
    Write-Host ""
    Write-Host "🚀 Starting Services..." -ForegroundColor Cyan
    
    # Start main server
    Write-Host "  Starting main server..." -ForegroundColor White
    Start-Process -FilePath "node" -ArgumentList "test-complete-system.js" -WindowStyle Minimized
    Start-Sleep -Seconds 3
    
    # Test if server is running
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method Get -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✓ Server is running" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠ Server may not be fully started yet" -ForegroundColor Yellow
    }
    
    # Start Python content generator if Python is available
    if (Get-Command python -ErrorAction SilentlyContinue) {
        Write-Host "  Starting Python services..." -ForegroundColor White
        Start-Process -FilePath "python" -ArgumentList "run_content_generator.py" -WindowStyle Minimized -ErrorAction SilentlyContinue
        Write-Host "  ✓ Python services started" -ForegroundColor Green
    }
    
    return $true
}

# Function to open browser
function Open-Browser {
    Write-Host ""
    Write-Host "🌐 Opening Application..." -ForegroundColor Cyan
    
    Start-Sleep -Seconds 2
    
    # Open main application
    Start-Process "http://localhost:3000"
    Write-Host "  ✓ Main application opened" -ForegroundColor Green
    
    # Open content generator
    Start-Process "http://localhost:3000/content-generator-sandbox.html"
    Write-Host "  ✓ Content generator opened" -ForegroundColor Green
    
    return $true
}

# Function to display status
function Show-Status {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║              🎉 SYNTHEX IS NOW RUNNING! 🎉                ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "📍 Access Points:" -ForegroundColor Magenta
    Write-Host "  Main Application:    http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  Content Generator:   http://localhost:3000/content-generator-sandbox.html" -ForegroundColor Cyan
    Write-Host "  Dashboard:          http://localhost:3000/dashboard.html" -ForegroundColor Cyan
    Write-Host "  API Documentation:   http://localhost:3000/api" -ForegroundColor Cyan
    Write-Host "  Health Check:       http://localhost:3000/health" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "🛠️ Quick Commands:" -ForegroundColor Magenta
    Write-Host "  Test Content Gen:   python run_content_generator.py" -ForegroundColor Yellow
    Write-Host "  Run Full Tests:     python test_content_generation_system.py" -ForegroundColor Yellow
    Write-Host "  Check Health:       curl http://localhost:3000/health" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "💡 Tips:" -ForegroundColor Magenta
    Write-Host "  • Keep this window open to maintain the server" -ForegroundColor White
    Write-Host "  • Press Ctrl+C to stop all services" -ForegroundColor White
    Write-Host "  • Check logs in the ./logs directory" -ForegroundColor White
    Write-Host ""
}

# Main execution
try {
    # Check requirements
    if (-not (Test-Requirements)) {
        Write-Host ""
        Write-Host "❌ Requirements check failed. Please install missing components." -ForegroundColor Red
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Install dependencies
    if (-not (Install-Dependencies)) {
        Write-Host ""
        Write-Host "❌ Failed to install dependencies." -ForegroundColor Red
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Start services
    if (-not (Start-Services)) {
        Write-Host ""
        Write-Host "❌ Failed to start services." -ForegroundColor Red
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Open browser
    Open-Browser | Out-Null
    
    # Show status
    Show-Status
    
    # Keep script running
    Write-Host "Press Ctrl+C to stop all services..." -ForegroundColor Gray
    
    # Wait for user to stop
    while ($true) {
        Start-Sleep -Seconds 60
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ An error occurred: $_" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
} finally {
    # Cleanup on exit
    Write-Host ""
    Write-Host "Shutting down services..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "Goodbye! 👋" -ForegroundColor Cyan
}