# Vercel Deployment Status Checker
# Checks if your Synthex deployment is healthy

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Synthex - Deployment Health Check   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "https://synthex-h4j7.vercel.app"

Write-Host "Checking deployment at: $baseUrl" -ForegroundColor Yellow
Write-Host ""

# Check health endpoint
Write-Host "1. Checking /health endpoint..." -ForegroundColor White
try {
    $healthResponse = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -UseBasicParsing
    if ($healthResponse.StatusCode -eq 200) {
        Write-Host "   ✓ Health check passed" -ForegroundColor Green
        Write-Host "   Response: $($healthResponse.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Health check failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check main page
Write-Host "2. Checking main page..." -ForegroundColor White
try {
    $mainResponse = Invoke-WebRequest -Uri $baseUrl -Method GET -UseBasicParsing
    if ($mainResponse.StatusCode -eq 200) {
        Write-Host "   ✓ Main page is accessible" -ForegroundColor Green
        $contentLength = $mainResponse.Content.Length
        Write-Host "   Page size: $contentLength bytes" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ✗ Main page not accessible" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Check API endpoint
Write-Host "3. Checking /api endpoint..." -ForegroundColor White
try {
    $apiResponse = Invoke-WebRequest -Uri "$baseUrl/api" -Method GET -UseBasicParsing
    if ($apiResponse.StatusCode -eq 200) {
        Write-Host "   ✓ API is responding" -ForegroundColor Green
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "   ⚠ API endpoint returns 404 (may be expected)" -ForegroundColor Yellow
    } else {
        Write-Host "   ✗ API check failed" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Summary
Write-Host "Deployment URL: $baseUrl" -ForegroundColor White
Write-Host "Dashboard: https://vercel.com/dashboard/synthex" -ForegroundColor White
Write-Host ""

Write-Host "If deployment is not working:" -ForegroundColor Yellow
Write-Host "1. Check Vercel dashboard for build logs" -ForegroundColor White
Write-Host "2. Verify environment variables are set" -ForegroundColor White
Write-Host "3. Run: ./deploy.bat to trigger new deployment" -ForegroundColor White

Write-Host ""
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host