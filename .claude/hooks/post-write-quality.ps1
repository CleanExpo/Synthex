# post-write-quality.ps1
# PostToolUse hook for Write -- checks for placeholder text and potential secrets
# Exit 0 = pass (informational warnings only, never blocks post-write)

param(
    [string]$ToolInput
)

try {
    $input = $ToolInput | ConvertFrom-Json
    $filePath = $input.file_path
} catch {
    exit 0
}

if (-not $filePath -or -not (Test-Path $filePath)) { exit 0 }

# Skip binary files and large files
$ext = [System.IO.Path]::GetExtension($filePath)
$binaryExts = @('.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.tar', '.gz')
if ($binaryExts -contains $ext) { exit 0 }

$fileSize = (Get-Item $filePath).Length
if ($fileSize -gt 1MB) { exit 0 }

$content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
if (-not $content) { exit 0 }

$warnings = @()

# Check for placeholder text
$placeholderPatterns = @(
    '\[TODO\]',
    '\[PLACEHOLDER\]',
    '\[FIXME\]',
    'YOUR_.*_HERE',
    'REPLACE_.*_WITH',
    'xxx+',
    'CHANGEME'
)

foreach ($pattern in $placeholderPatterns) {
    if ($content -match $pattern) {
        $warnings += "Placeholder detected: pattern '$pattern' found in $filePath"
    }
}

# Check for potential secrets (only in non-.env files)
if ($ext -ne '.env' -and $filePath -notlike '*example*') {
    $secretPatterns = @(
        'sk-[a-zA-Z0-9]{20,}',
        'AKIA[0-9A-Z]{16}',
        'ghp_[a-zA-Z0-9]{36}',
        'glpat-[a-zA-Z0-9\-]{20,}',
        'xoxb-[0-9]{10,}',
        'password\s*[=:]\s*["\x27][^"\x27]{8,}'
    )

    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) {
            $warnings += "POTENTIAL SECRET detected: pattern '$pattern' found in $filePath"
        }
    }
}

if ($warnings.Count -gt 0) {
    Write-Warning "POST-WRITE QUALITY CHECK:`n$($warnings -join "`n")"
}

exit 0
