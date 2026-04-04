# pre-write-validate.ps1
# PreToolUse hook for Write -- validates file paths are safe
# Exit 0 = allow, Exit 2 = block

param(
    [string]$ToolInput
)

try {
    $input = $ToolInput | ConvertFrom-Json
    $filePath = $input.file_path
} catch {
    exit 0
}

if (-not $filePath) { exit 0 }

# Critical files that should never be overwritten without explicit intent
$protectedFiles = @(
    'vercel.json',
    '.env',
    '.env.production',
    '.env.local',
    'prisma\schema.prisma',
    'package-lock.json',
    'tsconfig.json'
)

$fileName = Split-Path $filePath -Leaf
$relativePath = $filePath -replace [regex]::Escape("D:\Synthex\"), ""

foreach ($protected in $protectedFiles) {
    if ($relativePath -like "*$protected") {
        Write-Warning "CAUTION: Writing to protected file '$relativePath'. Ensure this is intentional."
        # Warn but allow -- exit 0 (not blocking, just alerting)
        break
    }
}

# Block writes outside the project directory
if ($filePath -notlike "D:\Synthex\*") {
    Write-Error "BLOCKED: Write target '$filePath' is outside the project directory"
    exit 2
}

# Block writes to node_modules
if ($filePath -like "*\node_modules\*") {
    Write-Error "BLOCKED: Cannot write to node_modules -- use npm install instead"
    exit 2
}

# Block writes to .git internals
if ($filePath -like "*\.git\*") {
    Write-Error "BLOCKED: Cannot write directly to .git directory"
    exit 2
}

exit 0
