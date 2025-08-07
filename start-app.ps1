Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "    SYNTHEX - Starting Application" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Start the server
Write-Host "Starting SYNTHEX server..." -ForegroundColor Green
Write-Host ""
Write-Host "The application will be available at:" -ForegroundColor White
Write-Host "  - Home:      " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Blue
Write-Host "  - Login:     " -NoNewline; Write-Host "http://localhost:3001/login" -ForegroundColor Blue
Write-Host "  - Dashboard: " -NoNewline; Write-Host "http://localhost:3001/dashboard" -ForegroundColor Blue
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Run the simple server
node simple-server.js