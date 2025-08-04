# Vercel Manual Deployment Script for Synthex
# Generated on 2025-08-04

$webhookUrl = "https://api.vercel.com/v1/integrations/deploy/prj_QcJrayyUbPteT2ez5JKpImPLgCWZ/wyQpfX55Zx"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Synthex - Triggering Vercel Deploy  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Sending deployment request..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method POST -UseBasicParsing
    
    if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201) {
        Write-Host ""
        Write-Host "Deployment triggered successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check deployment status at:" -ForegroundColor White
        Write-Host "https://vercel.com/dashboard/synthex" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Or visit your app at:" -ForegroundColor White
        Write-Host "https://synthex-h4j7.vercel.app/" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "Unexpected status code: $($response.StatusCode)" -ForegroundColor Yellow
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host ""
    Write-Host "Deployment request failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check your internet connection" -ForegroundColor White
    Write-Host "2. Verify the webhook URL is correct" -ForegroundColor White
    Write-Host "3. Regenerate the hook in Vercel if needed" -ForegroundColor White
}

Write-Host ""
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host