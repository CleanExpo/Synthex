# PowerShell TLS Certificate Check Script
# Monitors certificate expiry and configuration

param(
    [string]$Domain = "synthex.social",
    [int]$WarningDays = 30,
    [int]$CriticalDays = 7
)

Write-Host "🔒 Checking TLS Certificate for: $Domain" -ForegroundColor Cyan

try {
    # Create TCP connection
    $tcp = New-Object Net.Sockets.TcpClient($Domain, 443)
    $ssl = New-Object Net.Security.SslStream($tcp.GetStream(), $false, ({$True}))
    
    # Authenticate as client
    $ssl.AuthenticateAsClient($Domain)
    
    # Get certificate
    $cert = $ssl.RemoteCertificate
    
    # Parse certificate details
    $certInfo = @{
        Subject = $cert.Subject
        Issuer = $cert.Issuer
        SerialNumber = $cert.GetSerialNumberString()
        NotBefore = [DateTime]::Parse($cert.GetEffectiveDateString())
        NotAfter = [DateTime]::Parse($cert.GetExpirationDateString())
        Thumbprint = $cert.GetCertHashString()
        SignatureAlgorithm = $cert.SignatureAlgorithm.FriendlyName
    }
    
    # Calculate days until expiry
    $daysUntilExpiry = ($certInfo.NotAfter - (Get-Date)).Days
    
    # Check SANs (Subject Alternative Names)
    $sanExtension = $cert.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.17" }
    if ($sanExtension) {
        $certInfo.SANs = $sanExtension.Format($false)
    }
    
    # Display results
    Write-Host "`n📋 Certificate Details:" -ForegroundColor Green
    Write-Host "  Subject: $($certInfo.Subject)"
    Write-Host "  Issuer: $($certInfo.Issuer)"
    Write-Host "  Valid From: $($certInfo.NotBefore)"
    Write-Host "  Valid Until: $($certInfo.NotAfter)"
    Write-Host "  Days Until Expiry: $daysUntilExpiry"
    Write-Host "  Signature Algorithm: $($certInfo.SignatureAlgorithm)"
    
    if ($certInfo.SANs) {
        Write-Host "`n🔗 Subject Alternative Names:"
        Write-Host "  $($certInfo.SANs)"
    }
    
    # Check expiry status
    if ($daysUntilExpiry -le $CriticalDays) {
        Write-Host "`n🚨 CRITICAL: Certificate expires in $daysUntilExpiry days!" -ForegroundColor Red
        exit 2
    }
    elseif ($daysUntilExpiry -le $WarningDays) {
        Write-Host "`n⚠️ WARNING: Certificate expires in $daysUntilExpiry days" -ForegroundColor Yellow
        exit 1
    }
    else {
        Write-Host "`n✅ Certificate is valid for $daysUntilExpiry more days" -ForegroundColor Green
    }
    
    # Test HSTS
    Write-Host "`n🔐 Checking Security Headers..."
    $webRequest = [System.Net.WebRequest]::Create("https://$Domain")
    $webRequest.Method = "HEAD"
    $response = $webRequest.GetResponse()
    
    $headers = @{
        HSTS = $response.Headers["Strict-Transport-Security"]
        CSP = $response.Headers["Content-Security-Policy"]
        XFrame = $response.Headers["X-Frame-Options"]
        XContent = $response.Headers["X-Content-Type-Options"]
    }
    
    foreach ($header in $headers.GetEnumerator()) {
        if ($header.Value) {
            Write-Host "  ✅ $($header.Key): Present" -ForegroundColor Green
        }
        else {
            Write-Host "  ⚠️ $($header.Key): Missing" -ForegroundColor Yellow
        }
    }
    
    $response.Close()
    
    # Save report
    $reportPath = "ship-audit\artifacts\tls-report-$(Get-Date -Format 'yyyy-MM-dd').json"
    $report = @{
        timestamp = (Get-Date).ToString("o")
        domain = $Domain
        certificate = $certInfo
        daysUntilExpiry = $daysUntilExpiry
        securityHeaders = $headers
        status = if ($daysUntilExpiry -le $CriticalDays) { "critical" } `
                elseif ($daysUntilExpiry -le $WarningDays) { "warning" } `
                else { "ok" }
    }
    
    $report | ConvertTo-Json -Depth 10 | Out-File $reportPath
    Write-Host "`n📄 Report saved to: $reportPath" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error checking certificate: $_" -ForegroundColor Red
    exit 3
} finally {
    if ($tcp) { $tcp.Close() }
}