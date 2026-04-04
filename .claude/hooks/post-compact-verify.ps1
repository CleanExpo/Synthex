# Post-Compact Verification Hook
# Fires AFTER context compaction to verify critical state was preserved.
# Companion to pre-compact-save.ps1 which saves state BEFORE compaction.

$scratchpadDir = "D:\Synthex\.claude\scratchpad"
$preCompactState = "$scratchpadDir\pre-compact-state.md"
$sessionFile = "$scratchpadDir\current-session.md"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

# Check if pre-compact state was saved (should exist from PreCompact hook)
if (Test-Path $preCompactState) {
    $stateAge = (Get-Date) - (Get-Item $preCompactState).LastWriteTime
    if ($stateAge.TotalMinutes -lt 5) {
        # State was recently saved — inject it as additional context
        $stateContent = Get-Content $preCompactState -Raw

        # Build verification reminder
        $reminder = @"

--- POST-COMPACT CONTEXT RESTORATION ---
Timestamp: $timestamp
The following state was saved before compaction. Verify it matches your current understanding:

$stateContent

ACTION: If any of the above seems unfamiliar, re-read CONSTITUTION.md and CLAUDE.md.
--- END RESTORATION ---
"@

        Write-Output $reminder
    }
} else {
    Write-Output "--- POST-COMPACT: No pre-compact state file found. Re-read CONSTITUTION.md + CLAUDE.md. ---"
}

# Log the compaction event to session scratchpad
if (Test-Path $sessionFile) {
    $existingContent = Get-Content $sessionFile -Raw
    $compactNote = "`n`n## [$timestamp] Context Compacted`n- Post-compact hook fired`n- State restoration injected"
    Set-Content -Path $sessionFile -Value ($existingContent + $compactNote) -NoNewline
}
