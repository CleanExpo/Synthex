# pre-compact-save.ps1
# PreCompact hook - fires before Claude Code compacts the context window
# Saves current session state to scratchpad to prevent context drift

$scratchpadDir = "D:\Synthex\.claude\scratchpad"
$stateFile = "$scratchpadDir\pre-compact-state.md"

# Ensure scratchpad directory exists
if (-not (Test-Path $scratchpadDir)) {
    New-Item -ItemType Directory -Path $scratchpadDir | Out-Null
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$lines = @()
$lines += "## Pre-Compact State - $timestamp"
$lines += ""

# Git state
$branch = git -C "D:\Synthex" branch --show-current 2>$null
$recentCommits = git -C "D:\Synthex" log --oneline -5 2>$null
$lines += "### Git"
$lines += "Branch: $branch"
foreach ($commit in $recentCommits) { $lines += "  $commit" }
$lines += ""

# Current position from STATE.md
$stateFile2 = "D:\Synthex\.planning\STATE.md"
if (Test-Path $stateFile2) {
    $lines += "### Current Position (STATE.md)"
    Get-Content $stateFile2 | Select-Object -First 18 | ForEach-Object { $lines += $_ }
    $lines += ""
}

# Active compass
$compassFile = "D:\Synthex\.claude\memory\compass.md"
if (Test-Path $compassFile) {
    $lines += "### Compass"
    Get-Content $compassFile | ForEach-Object { $lines += $_ }
    $lines += ""
}

$lines | Set-Content -Path $stateFile -Encoding UTF8
Write-Output "[PreCompact] Context state saved to .claude/scratchpad/pre-compact-state.md"
exit 0
