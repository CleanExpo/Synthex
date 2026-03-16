# Synthex Dependency Verification Functions (PowerShell)
# Reusable functions for checking npm dependencies on Windows
# Dot-source this file: . .\scripts\dependency-checks.ps1
# Adapted from NodeJS-Starter-V1 for Synthex (npm, single-package workspace, Windows 11)

# ============================================================================
# Function 1: Test Lockfile Integrity
# ============================================================================
function Test-LockfileIntegrity {
    [CmdletBinding()]
    param()

    $lockfile = "package-lock.json"
    $packageJson = "package.json"

    # Check existence
    if (-not (Test-Path $lockfile)) {
        return @{
            Success  = $false
            Severity = "Error"
            Message  = "Lockfile $lockfile does not exist (run npm install)"
        }
    }

    if (-not (Test-Path $packageJson)) {
        return @{
            Success  = $false
            Severity = "Error"
            Message  = "$packageJson does not exist"
        }
    }

    # Check JSON validity
    $content = Get-Content $lockfile -Raw
    if ($content -notmatch '"lockfileVersion"') {
        return @{
            Success  = $false
            Severity = "Error"
            Message  = "Lockfile missing lockfileVersion field"
        }
    }

    # Check modification times
    $pkgMtime  = (Get-Item $packageJson).LastWriteTime
    $lockMtime = (Get-Item $lockfile).LastWriteTime

    if ($lockMtime -lt $pkgMtime) {
        return @{
            Success  = $false
            Severity = "Warning"
            Message  = "Lockfile is older than package.json (may be out of sync — run npm install)"
        }
    }

    return @{ Success = $true }
}

# ============================================================================
# Function 2: Test Dependency Synchronisation
# Verifies that declared dependencies are installed with correct versions
# ============================================================================
function Test-DependencySync {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Workspace
    )

    $packageJson = Join-Path $Workspace "package.json"
    if (-not (Test-Path $packageJson)) {
        return @{
            Success    = $false
            Missing    = @()
            Mismatched = @()
        }
    }

    try {
        $pkg = Get-Content $packageJson -Raw | ConvertFrom-Json
    }
    catch {
        return @{
            Success    = $false
            Missing    = @()
            Mismatched = @()
        }
    }

    $deps = @{}

    # Collect all dependencies
    if ($pkg.dependencies) {
        $pkg.dependencies.PSObject.Properties | ForEach-Object {
            $deps[$_.Name] = $_.Value
        }
    }
    if ($pkg.devDependencies) {
        $pkg.devDependencies.PSObject.Properties | ForEach-Object {
            $deps[$_.Name] = $_.Value
        }
    }

    $missing    = @()
    $mismatched = @()

    foreach ($dep in $deps.GetEnumerator()) {
        # Skip workspace: and file: references
        if ($dep.Value -like "workspace:*" -or $dep.Value -like "file:*") {
            continue
        }

        # Check installation paths (npm uses root node_modules)
        $localModulePath = Join-Path $Workspace "node_modules" $dep.Key "package.json"
        $rootModulePath  = Join-Path "node_modules" $dep.Key "package.json"

        $installed        = $false
        $installedVersion = $null

        # Check local node_modules
        if (Test-Path $localModulePath) {
            try {
                $installedPkg     = Get-Content $localModulePath -Raw | ConvertFrom-Json
                $installed        = $true
                $installedVersion = $installedPkg.version
            }
            catch {
                # Ignore parse errors
            }
        }

        # Check root node_modules
        if (-not $installed -and (Test-Path $rootModulePath)) {
            try {
                $installedPkg     = Get-Content $rootModulePath -Raw | ConvertFrom-Json
                $installed        = $true
                $installedVersion = $installedPkg.version
            }
            catch {
                # Ignore parse errors
            }
        }

        # Report issues
        if (-not $installed) {
            $missing += @{
                Name    = $dep.Key
                Version = $dep.Value
            }
        }
        elseif ($installedVersion) {
            $declaredClean = $dep.Value -replace '^[\^~>=<]+', ''
            if ($declaredClean -ne "*" -and $declaredClean -ne $installedVersion -and $dep.Value -notlike "*$installedVersion*") {
                $mismatched += @{
                    Name      = $dep.Key
                    Declared  = $dep.Value
                    Installed = $installedVersion
                }
            }
        }
    }

    return @{
        Success    = ($missing.Count -eq 0 -and $mismatched.Count -eq 0)
        Missing    = $missing
        Mismatched = $mismatched
    }
}

# ============================================================================
# Function 3: Test for Orphaned Dependencies
# Finds packages in node_modules not declared in package.json
# ============================================================================
function Test-OrphanedDependencies {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Workspace
    )

    $nodeModules = Join-Path $Workspace "node_modules"
    if (-not (Test-Path $nodeModules)) {
        return @{ Orphaned = @() }
    }

    $packageJson = Join-Path $Workspace "package.json"
    if (-not (Test-Path $packageJson)) {
        return @{ Orphaned = @() }
    }

    try {
        $pkg = Get-Content $packageJson -Raw | ConvertFrom-Json
    }
    catch {
        return @{ Orphaned = @() }
    }

    $declared = @{}

    # Collect declared dependencies
    if ($pkg.dependencies) {
        $pkg.dependencies.PSObject.Properties | ForEach-Object {
            $declared[$_.Name] = $true
        }
    }
    if ($pkg.devDependencies) {
        $pkg.devDependencies.PSObject.Properties | ForEach-Object {
            $declared[$_.Name] = $true
        }
    }

    $orphaned = @()

    # Check all entries in node_modules
    Get-ChildItem $nodeModules -Directory | ForEach-Object {
        $name = $_.Name

        # Skip system directories
        if ($name -like ".*" -or $name -eq ".bin" -or $name -eq ".cache") {
            return
        }

        if ($name -like "@*") {
            # Handle scoped packages
            $scopePath = $_.FullName
            Get-ChildItem $scopePath -Directory | ForEach-Object {
                $scopedName = $_.Name
                if ($scopedName -notlike ".*") {
                    $fullName = "$name/$scopedName"
                    if (-not $declared[$fullName]) {
                        $pkgJsonPath = Join-Path $_.FullName "package.json"
                        if (Test-Path $pkgJsonPath) {
                            try {
                                $mod = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
                                $orphaned += @{
                                    Name    = $fullName
                                    Version = $mod.version
                                }
                            }
                            catch {
                                # Ignore parse errors
                            }
                        }
                    }
                }
            }
        }
        else {
            # Regular package
            if (-not $declared[$name]) {
                $pkgJsonPath = Join-Path $_.FullName "package.json"
                if (Test-Path $pkgJsonPath) {
                    try {
                        $mod = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
                        $orphaned += @{
                            Name    = $name
                            Version = $mod.version
                        }
                    }
                    catch {
                        # Ignore parse errors
                    }
                }
            }
        }
    }

    return @{ Orphaned = $orphaned }
}

# ============================================================================
# Function 4: Test Environment Variables
# Verifies required env vars are present (.env.example is the source of truth)
# ============================================================================
function Test-EnvVars {
    [CmdletBinding()]
    param(
        [string]$EnvExample = ".env.example"
    )

    if (-not (Test-Path $EnvExample)) {
        return @{
            Success = $false
            Missing = @()
            Message = ".env.example not found — cannot validate env vars"
        }
    }

    # Extract required variable names from .env.example
    $lines = Get-Content $EnvExample
    $requiredVars = $lines | Where-Object { $_ -match '^[A-Z_]+=' -and $_ -notmatch '^#' } |
        ForEach-Object { ($_ -split '=')[0] }

    $missing = @()

    foreach ($var in $requiredVars) {
        if ([string]::IsNullOrEmpty($var)) { continue }

        # Check process environment
        $envVal = [System.Environment]::GetEnvironmentVariable($var)
        if ($envVal) { continue }

        # Check .env.local
        if (Test-Path ".env.local") {
            $localContent = Get-Content ".env.local" -Raw
            if ($localContent -match "^$var=.+") { continue }
        }

        # Check .env
        if (Test-Path ".env") {
            $envContent = Get-Content ".env" -Raw
            if ($envContent -match "^$var=.+") { continue }
        }

        $missing += $var
    }

    return @{
        Success = ($missing.Count -eq 0)
        Missing = $missing
    }
}

# ============================================================================
# Module initialisation — runs when dot-sourced
# ============================================================================
Write-Host "Dependency verification functions loaded" -ForegroundColor Green
Write-Host "Available functions:" -ForegroundColor Cyan
Write-Host "  - Test-LockfileIntegrity" -ForegroundColor Gray
Write-Host "  - Test-DependencySync -Workspace <path>" -ForegroundColor Gray
Write-Host "  - Test-OrphanedDependencies -Workspace <path>" -ForegroundColor Gray
Write-Host "  - Test-EnvVars [-EnvExample <path>]" -ForegroundColor Gray
