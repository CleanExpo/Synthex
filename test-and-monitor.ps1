# SYNTHEX Test and Monitor Script
# Starts server and runs continuous Playwright tests

Write-Host "Starting SYNTHEX Test Server..." -ForegroundColor Green

# Start the server in a background job
$serverJob = Start-Job -ScriptBlock {
    Set-Location "D:\Synthex"
    node test-server.js
}

# Wait for server to start
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Check if server is running
$testConnection = Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue

if ($testConnection.TcpTestSucceeded) {
    Write-Host "✅ Server is running on port 3002" -ForegroundColor Green
    Write-Host "Opening http://localhost:3002 in browser..." -ForegroundColor Cyan
    Start-Process "http://localhost:3002"
} else {
    Write-Host "❌ Server failed to start on port 3002" -ForegroundColor Red
    
    # Try alternative port
    Write-Host "Trying alternative port 3003..." -ForegroundColor Yellow
    $serverJob2 = Start-Job -ScriptBlock {
        Set-Location "D:\Synthex"
        $env:PORT = 3003
        node test-server.js
    }
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:3003"
}

Write-Host "`nServer job started. Press Ctrl+C to stop monitoring." -ForegroundColor Cyan

# Keep the script running
while ($true) {
    Start-Sleep -Seconds 5
    
    # Check server health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3002/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "." -NoNewline -ForegroundColor Green
        }
    } catch {
        Write-Host "X" -NoNewline -ForegroundColor Red
    }
}