# SYNTHEX Complete Monitoring System
# Starts server, continuous testing, and monitoring dashboard

Write-Host "`n🚀 SYNTHEX MONITORING SYSTEM" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is already running
$serverRunning = Test-NetConnection -ComputerName localhost -Port 3002 -InformationLevel Quiet -WarningAction SilentlyContinue

if (-not $serverRunning) {
    Write-Host "📦 Starting SYNTHEX server..." -ForegroundColor Yellow
    
    # Start server in background
    $serverJob = Start-Job -ScriptBlock {
        Set-Location "D:\Synthex"
        node test-server.js
    }
    
    Write-Host "⏳ Waiting for server to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Verify server started
    $serverRunning = Test-NetConnection -ComputerName localhost -Port 3002 -InformationLevel Quiet -WarningAction SilentlyContinue
    
    if ($serverRunning) {
        Write-Host "✅ Server running on port 3002" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to start server" -ForegroundColor Red
        Write-Host "Please run manually: node test-server.js" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "✅ Server already running on port 3002" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔍 Starting continuous testing..." -ForegroundColor Yellow

# Start continuous testing in background
$testingJob = Start-Job -ScriptBlock {
    Set-Location "D:\Synthex"
    node playwright-continuous-test.js
}

Write-Host "✅ Continuous testing started" -ForegroundColor Green

Write-Host ""
Write-Host "📊 Opening monitoring dashboard..." -ForegroundColor Yellow

# Open monitoring dashboard
Start-Process "D:\Synthex\monitoring-dashboard.html"

Write-Host "✅ Monitoring dashboard opened" -ForegroundColor Green

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "🎯 MONITORING ACTIVE" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access Points:" -ForegroundColor White
Write-Host "  📱 Application: http://localhost:3002" -ForegroundColor Cyan
Write-Host "  📊 Dashboard: file:///D:/Synthex/monitoring-dashboard.html" -ForegroundColor Cyan
Write-Host "  📝 Issues Log: D:\Synthex\testing-issues.json" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Monitor jobs
while ($true) {
    $serverStatus = if ($serverJob) { $serverJob.State } else { "External" }
    $testingStatus = $testingJob.State
    
    Write-Host -NoNewline "`r[$(Get-Date -Format 'HH:mm:ss')] " -ForegroundColor DarkGray
    Write-Host -NoNewline "Server: " -ForegroundColor White
    Write-Host -NoNewline "$serverStatus " -ForegroundColor $(if ($serverStatus -eq "Running" -or $serverStatus -eq "External") { "Green" } else { "Red" })
    Write-Host -NoNewline "| Testing: " -ForegroundColor White
    Write-Host -NoNewline "$testingStatus " -ForegroundColor $(if ($testingStatus -eq "Running") { "Green" } else { "Red" })
    
    # Check for new issues
    if (Test-Path "D:\Synthex\testing-issues.json") {
        $issues = Get-Content "D:\Synthex\testing-issues.json" | ConvertFrom-Json
        $openIssues = $issues | Where-Object { $_.status -eq "open" }
        Write-Host -NoNewline "| Issues: " -ForegroundColor White
        Write-Host -NoNewline "$($openIssues.Count) " -ForegroundColor $(if ($openIssues.Count -eq 0) { "Green" } elseif ($openIssues.Count -lt 10) { "Yellow" } else { "Red" })
    }
    
    Start-Sleep -Seconds 5
}

# Cleanup on exit
trap {
    Write-Host "`n`n🛑 Shutting down monitoring system..." -ForegroundColor Yellow
    
    if ($serverJob) {
        Stop-Job $serverJob
        Remove-Job $serverJob
    }
    
    if ($testingJob) {
        Stop-Job $testingJob  
        Remove-Job $testingJob
    }
    
    Write-Host "✅ All services stopped" -ForegroundColor Green
    exit
}