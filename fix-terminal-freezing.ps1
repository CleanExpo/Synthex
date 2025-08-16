# PowerShell Script to Fix Terminal Freezing in Windows
# Run this script as Administrator

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Terminal Freezing Fix for Windows" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "⚠️  This script needs to run as Administrator!" -ForegroundColor Yellow
    Write-Host "Restarting with elevated privileges..." -ForegroundColor Yellow
    Start-Process PowerShell -Verb RunAs "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "✅ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Step 1: Increase Windows file watcher limits
Write-Host "Step 1: Increasing Windows file watcher limits..." -ForegroundColor Yellow
try {
    # Increase maximum user ports
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "MaxUserPort" -Value 65534 -ErrorAction Stop
    Write-Host "  ✓ MaxUserPort set to 65534" -ForegroundColor Green
    
    # Reduce TCP timed wait delay
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "TcpTimedWaitDelay" -Value 30 -ErrorAction Stop
    Write-Host "  ✓ TcpTimedWaitDelay set to 30" -ForegroundColor Green
}
catch {
    Write-Host "  ⚠️  Failed to update registry settings: $_" -ForegroundColor Red
}
Write-Host ""

# Step 2: Clear npm cache
Write-Host "Step 2: Clearing npm cache..." -ForegroundColor Yellow
try {
    npm cache clean --force 2>$null
    Write-Host "  ✓ npm cache cleared" -ForegroundColor Green
}
catch {
    Write-Host "  ⚠️  Failed to clear npm cache: $_" -ForegroundColor Red
}
Write-Host ""

# Step 3: Clean .next build cache
Write-Host "Step 3: Cleaning Next.js build cache..." -ForegroundColor Yellow
if (Test-Path ".next") {
    try {
        Remove-Item -Recurse -Force ".next" -ErrorAction Stop
        Write-Host "  ✓ .next folder removed" -ForegroundColor Green
    }
    catch {
        Write-Host "  ⚠️  Failed to remove .next folder: $_" -ForegroundColor Red
    }
}
else {
    Write-Host "  ℹ️  .next folder not found (already clean)" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Set Node.js memory options
Write-Host "Step 4: Setting Node.js memory options..." -ForegroundColor Yellow
try {
    [Environment]::SetEnvironmentVariable("NODE_OPTIONS", "--max-old-space-size=4096", "User")
    Write-Host "  ✓ NODE_OPTIONS set to --max-old-space-size=4096" -ForegroundColor Green
}
catch {
    Write-Host "  ⚠️  Failed to set NODE_OPTIONS: $_" -ForegroundColor Red
}
Write-Host ""

# Step 5: Clean and reinstall dependencies (optional)
Write-Host "Step 5: Would you like to clean and reinstall node_modules?" -ForegroundColor Yellow
Write-Host "  This will take a few minutes but can fix many issues." -ForegroundColor Gray
$response = Read-Host "  Clean and reinstall? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "  Removing node_modules..." -ForegroundColor Gray
    if (Test-Path "node_modules") {
        try {
            Remove-Item -Recurse -Force "node_modules" -ErrorAction Stop
            Write-Host "  ✓ node_modules removed" -ForegroundColor Green
        }
        catch {
            Write-Host "  ⚠️  Failed to remove node_modules: $_" -ForegroundColor Red
        }
    }
    
    Write-Host "  Removing package-lock.json..." -ForegroundColor Gray
    if (Test-Path "package-lock.json") {
        try {
            Remove-Item -Force "package-lock.json" -ErrorAction Stop
            Write-Host "  ✓ package-lock.json removed" -ForegroundColor Green
        }
        catch {
            Write-Host "  ⚠️  Failed to remove package-lock.json: $_" -ForegroundColor Red
        }
    }
    
    Write-Host "  Installing dependencies..." -ForegroundColor Gray
    npm install
    Write-Host "  ✓ Dependencies reinstalled" -ForegroundColor Green
}
else {
    Write-Host "  Skipping node_modules reinstall" -ForegroundColor Gray
}
Write-Host ""

# Step 6: Check current Node.js process status
Write-Host "Step 6: Checking Node.js process status..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  Current Node.js processes:" -ForegroundColor Gray
    $nodeProcesses | Select-Object -Property ProcessName, Id, HandleCount, @{Name = "Memory(MB)"; Expression = { [math]::Round($_.WorkingSet / 1MB, 2) } } | Format-Table
}
else {
    Write-Host "  No Node.js processes currently running" -ForegroundColor Gray
}
Write-Host ""

# Final instructions
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✅ Terminal Optimization Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Recommended next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your terminal/VSCode" -ForegroundColor White
Write-Host "2. Run the dev server with: npm run dev" -ForegroundColor White
Write-Host "3. If issues persist, try: npm run dev -- --experimental-watch" -ForegroundColor White
Write-Host ""
Write-Host "The following optimizations have been applied:" -ForegroundColor Gray
Write-Host "  • Next.js webpack configured to use polling mode" -ForegroundColor Gray
Write-Host "  • VSCode file watchers optimized" -ForegroundColor Gray
Write-Host "  • Windows registry settings updated" -ForegroundColor Gray
Write-Host "  • Node.js memory limit increased to 4GB" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
