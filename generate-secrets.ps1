# Generate secure random secrets for Vercel environment variables

Write-Host "Generating secure secrets for your environment variables..." -ForegroundColor Green
Write-Host ""

# Generate JWT_SECRET
$jwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
Write-Host "JWT_SECRET:" -ForegroundColor Yellow
Write-Host $jwt -ForegroundColor Cyan
Write-Host ""

# Generate NEXTAUTH_SECRET
$nextauth = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
Write-Host "NEXTAUTH_SECRET:" -ForegroundColor Yellow
Write-Host $nextauth -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "COPY THESE VALUES TO VERCEL:" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "JWT_SECRET=$jwt" -ForegroundColor White
Write-Host "NEXTAUTH_SECRET=$nextauth" -ForegroundColor White
Write-Host ""

Write-Host "IMPORTANT: You still need to get your Supabase password from:" -ForegroundColor Red
Write-Host "https://supabase.com/dashboard/project/znyjoyjsvjotlzjppzal/settings/database" -ForegroundColor Yellow
