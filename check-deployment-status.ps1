# Deployment Status Checker
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   Checking Deployment Status       " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📍 Check these locations to verify deployment:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. GitHub Actions (Should show running/completed):" -ForegroundColor White
Write-Host "   https://github.com/CleanExpo/Synthex/actions" -ForegroundColor Cyan
Write-Host ""

Write-Host "2. Latest workflow run:" -ForegroundColor White
Write-Host "   https://github.com/CleanExpo/Synthex/actions/workflows/deploy.yml" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Vercel Dashboard (Should show new deployment):" -ForegroundColor White
Write-Host "   https://vercel.com/dashboard/synthex" -ForegroundColor Cyan
Write-Host ""

Write-Host "4. Live Application:" -ForegroundColor White
Write-Host "   https://synthex-h4j7.vercel.app/" -ForegroundColor Cyan
Write-Host ""

Write-Host "Expected Results:" -ForegroundColor Green
Write-Host "✓ GitHub Actions shows green checkmark" -ForegroundColor White
Write-Host "✓ Vercel shows 'Ready' status" -ForegroundColor White
Write-Host "✓ No error messages in logs" -ForegroundColor White
Write-Host ""

Write-Host "If deployment failed:" -ForegroundColor Red
Write-Host "• Check if VERCEL_DEPLOY_HOOK secret is correctly set" -ForegroundColor White
Write-Host "• Review GitHub Actions logs for errors" -ForegroundColor White
Write-Host "• Verify Vercel project still exists" -ForegroundColor White
Write-Host ""

$openBrowser = Read-Host "Open GitHub Actions in browser? (y/n)"
if ($openBrowser -eq 'y') {
    Start-Process "https://github.com/CleanExpo/Synthex/actions"
}

Write-Host ""
Write-Host "Press Enter to exit..." -ForegroundColor Gray
Read-Host