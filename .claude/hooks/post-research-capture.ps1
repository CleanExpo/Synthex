# post-research-capture.ps1
# PostToolUse hook for Write -- suggests knowledge base entries after research outputs
# Exit 0 = pass (informational only)

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

# Check if the written file looks like research output
$researchIndicators = @(
    '*research*',
    '*findings*',
    '*analysis*',
    '*report*',
    '*brief*',
    '*audit*',
    '*review*'
)

$fileName = Split-Path $filePath -Leaf
$isResearch = $false

foreach ($indicator in $researchIndicators) {
    if ($fileName -like $indicator) {
        $isResearch = $true
        break
    }
}

if (-not $isResearch) { exit 0 }

# Check if the file contains research-worthy content
if (Test-Path $filePath) {
    $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
    if ($content -and $content.Length -gt 500) {
        Write-Output ""
        Write-Output "=== KNOWLEDGE BASE SUGGESTION ==="
        Write-Output "Research output detected: $fileName"
        Write-Output "Consider capturing key findings to the knowledge base:"
        Write-Output "  Domain: Determine from content (seo/marketing/architecture/deployment/competitive)"
        Write-Output "  Command: Use knowledge-curator skill with CAPTURE operation"
        Write-Output "  Path: .claude/knowledge/domains/<domain>/"
        Write-Output "================================="
    }
}

exit 0
