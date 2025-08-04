# Quick test to trigger deployment after fixing GitHub Actions settings
Write-Host "Testing deployment after GitHub Actions fix..." -ForegroundColor Cyan

# Create a small change to trigger workflow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$content = @"
# Deployment Test
Last tested: $timestamp
This file triggers GitHub Actions workflow
"@

# Write test file
$content | Out-File -FilePath "deployment-test.txt" -Encoding UTF8

Write-Host "Created test file with timestamp: $timestamp" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now run these commands to trigger deployment:" -ForegroundColor Green
Write-Host '  git add deployment-test.txt' -ForegroundColor White
Write-Host '  git commit -m "Test GitHub Actions after settings fix"' -ForegroundColor White
Write-Host '  git push origin main' -ForegroundColor White
Write-Host ""
Write-Host "Then check:" -ForegroundColor Yellow
Write-Host "  GitHub Actions: https://github.com/CleanExpo/Synthex/actions" -ForegroundColor Cyan
Write-Host "  Vercel Dashboard: https://vercel.com/dashboard/synthex" -ForegroundColor Cyan