# Instructions Loaded Hook
# Fires when CLAUDE.md is loaded. Verifies CONSTITUTION.md awareness
# and logs session initialisation state.

$constitutionPath = "D:\Synthex\CONSTITUTION.md"
$compassPath = "D:\Synthex\.claude\memory\compass.md"
$sessionFile = "D:\Synthex\.claude\scratchpad\current-session.md"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

# Verify CONSTITUTION.md exists and is readable
if (Test-Path $constitutionPath) {
    $constitutionLines = (Get-Content $constitutionPath | Measure-Object -Line).Lines
    Write-Output "CONSTITUTION.md loaded ($constitutionLines lines)"
} else {
    Write-Output "WARNING: CONSTITUTION.md not found at $constitutionPath"
}

# Check compass exists
if (Test-Path $compassPath) {
    Write-Output "Compass loaded"
} else {
    Write-Output "WARNING: compass.md not found"
}

# Log to session file if it exists
if (Test-Path $sessionFile) {
    $content = Get-Content $sessionFile -Raw
    if ($content -and $content.Trim().Length -gt 0) {
        Write-Output "Session scratchpad has active content — check for interrupted work"
    }
}
