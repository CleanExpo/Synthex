# session-end-land-the-plane.ps1
# Session lifecycle hook -- "Land the Plane" protocol
# Creates session summary, prompts for knowledge updates, writes next-session checkpoint

param(
    [string]$SessionSummary = "",
    [string]$FilesModified = "",
    [string]$OpenItems = "",
    [string]$KnowledgeUpdates = ""
)

$checkpointDir = "D:\Synthex\.claude\checkpoints"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$sessionId = "session-$timestamp"

# Ensure checkpoint directory exists
if (-not (Test-Path $checkpointDir)) {
    New-Item -ItemType Directory -Path $checkpointDir -Force | Out-Null
}

Write-Output ""
Write-Output "========================================"
Write-Output "  LAND THE PLANE -- SESSION END"
Write-Output "  $timestamp"
Write-Output "========================================"

# Build the checkpoint content
$checkpoint = @"
---
session_id: $sessionId
timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
branch: $(git -C "D:\Synthex" branch --show-current 2>$null)
---

# Session Checkpoint: $sessionId

## Summary
$SessionSummary

## Files Modified
$FilesModified

## Open Items
$OpenItems

## Knowledge Base Updates
$KnowledgeUpdates

## Recent Commits
$(git -C "D:\Synthex" log --oneline -5 2>$null)

## Next Steps
<!-- Fill in before ending session -->

"@

# Write the checkpoint
$checkpointFile = "$checkpointDir\next-session.md"
$checkpoint | Out-File -FilePath $checkpointFile -Encoding utf8

# Archive a copy
$archiveFile = "$checkpointDir\archive\$sessionId.md"
$archiveDir = "$checkpointDir\archive"
if (-not (Test-Path $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
}
$checkpoint | Out-File -FilePath $archiveFile -Encoding utf8

Write-Output ""
Write-Output "Checkpoint saved: $checkpointFile"
Write-Output "Archive copy: $archiveFile"
Write-Output ""
Write-Output "Session $sessionId landed successfully."
Write-Output "========================================"

exit 0
