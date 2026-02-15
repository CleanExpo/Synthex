# session-start.ps1
# Session lifecycle hook -- loads last checkpoint and displays briefing
# Run manually at session start or wired to PreToolUse on first tool use

$checkpointDir = "D:\Synthex\.claude\checkpoints"
$nextSession = "$checkpointDir\next-session.md"

Write-Output ""
Write-Output "========================================"
Write-Output "  SYNTHEX SESSION START"
Write-Output "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Write-Output "========================================"

# Load last checkpoint if it exists
if (Test-Path $nextSession) {
    Write-Output ""
    Write-Output "--- PREVIOUS SESSION BRIEFING ---"
    Get-Content $nextSession
    Write-Output "--- END BRIEFING ---"
    Write-Output ""
} else {
    Write-Output ""
    Write-Output "No previous session checkpoint found."
    Write-Output "Starting fresh session."
    Write-Output ""
}

# Show current branch and recent changes
Write-Output "--- GIT STATUS ---"
$gitBranch = git -C "D:\Synthex" branch --show-current 2>$null
if ($gitBranch) {
    Write-Output "Branch: $gitBranch"
    $recentCommits = git -C "D:\Synthex" log --oneline -5 2>$null
    if ($recentCommits) {
        Write-Output "Recent commits:"
        $recentCommits | ForEach-Object { Write-Output "  $_" }
    }
}
Write-Output "--- END STATUS ---"
Write-Output ""

# Check PROGRESS.md for current phase
$progressFile = "D:\Synthex\PROGRESS.md"
if (Test-Path $progressFile) {
    $progressContent = Get-Content $progressFile -Raw
    if ($progressContent -match "Current Phase:\s*(.+)") {
        Write-Output "Current Phase: $($Matches[1])"
    }
}

exit 0
