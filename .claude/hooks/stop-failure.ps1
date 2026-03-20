# StopFailure Hook — Claude Code v2.1+
# Triggered when Claude stops due to a failure event.
# Saves current context to scratchpad so next session can resume cleanly.

param([string]$StopReason = "")

$timestamp = Get-Date -Format "HH:mm"
$date      = Get-Date -Format "yyyy-MM-dd"

$note = @"

## [$timestamp] StopFailure ($date)
- Reason: $StopReason
- Session interrupted — resume from last progress note above
- Run: cd D:\Synthex && git status to confirm working tree state

"@

$scratchpad = "D:\Synthex\.claude\scratchpad\current-session.md"

if (Test-Path $scratchpad) {
    Add-Content -Path $scratchpad -Value $note
} else {
    Set-Content -Path $scratchpad -Value $note
}
