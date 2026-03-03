# session-start-protocol.ps1
# SessionStart hook - fires at the start of each Claude Code session
# Replaces session-start.ps1 - prints orientation context to prevent context drift

$sep = "=" * 52

Write-Output ""
Write-Output $sep
Write-Output ("  SYNTHEX SESSION START - " + (Get-Date -Format 'yyyy-MM-dd HH:mm'))
Write-Output $sep

# 1. Compass - quick orientation
$compassFile = "D:\Synthex\.claude\memory\compass.md"
if (Test-Path $compassFile) {
    Write-Output ""
    Write-Output "--- COMPASS ---"
    Get-Content $compassFile | ForEach-Object { Write-Output $_ }
    Write-Output "--- END COMPASS ---"
}

# 2. Constitution summary (first 15 lines)
$constitutionFile = "D:\Synthex\CONSTITUTION.md"
if (Test-Path $constitutionFile) {
    Write-Output ""
    Write-Output "--- CONSTITUTION (top rules) ---"
    Get-Content $constitutionFile | Select-Object -First 15 | ForEach-Object { Write-Output $_ }
    Write-Output "  [read full CONSTITUTION.md for all rules]"
    Write-Output "--- END CONSTITUTION ---"
}

# 2.5. Linear status (live query if LINEAR_API_KEY env var is set)
$linearApiKey = $env:LINEAR_API_KEY
if ($linearApiKey) {
    try {
        $query = '{"query":"{ issues(filter: { state: { name: { eq: \"In Progress\" } }, team: { key: { eq: \"UNI\" } } }) { nodes { identifier title } } }"}'
        $result = Invoke-RestMethod `
            -Uri "https://api.linear.app/graphql" `
            -Method POST `
            -Headers @{ "Authorization" = $linearApiKey; "Content-Type" = "application/json" } `
            -Body $query `
            -ErrorAction Stop
        $issues = $result.data.issues.nodes
        if ($issues -and $issues.Count -gt 0) {
            Write-Output ""
            Write-Output "--- LINEAR: IN PROGRESS ---"
            foreach ($issue in $issues) {
                Write-Output ("  " + $issue.identifier + ": " + $issue.title)
            }
            Write-Output "--- END LINEAR ---"
        }
    } catch {
        # Linear API unavailable - compass.md Active Issues section is fallback
    }
} else {
    Write-Output ""
    Write-Output "  [TIP: Set LINEAR_API_KEY env var for live Linear status at session start]"
}

# 3. Pre-compact state if recent (< 2 hours old)
$preCompactFile = "D:\Synthex\.claude\scratchpad\pre-compact-state.md"
if (Test-Path $preCompactFile) {
    $age = (Get-Date) - (Get-Item $preCompactFile).LastWriteTime
    if ($age.TotalHours -lt 2) {
        Write-Output ""
        Write-Output "--- PRE-COMPACT STATE (recent - context was compacted) ---"
        Get-Content $preCompactFile | Select-Object -First 20 | ForEach-Object { Write-Output $_ }
        Write-Output "--- END PRE-COMPACT STATE ---"
    }
}

# 4. Interrupted session check
$sessionFile = "D:\Synthex\.claude\scratchpad\current-session.md"
if (Test-Path $sessionFile) {
    $content = Get-Content $sessionFile -Raw
    if ($content -and $content.Trim().Length -gt 10) {
        Write-Output ""
        Write-Output "--- INTERRUPTED WORK (current-session.md) ---"
        Get-Content $sessionFile | Select-Object -First 15 | ForEach-Object { Write-Output $_ }
        Write-Output "--- END INTERRUPTED WORK ---"
    }
}

# 5. Git status
Write-Output ""
Write-Output "--- GIT ---"
$branch = git -C "D:\Synthex" branch --show-current 2>$null
Write-Output "Branch: $branch"
git -C "D:\Synthex" log --oneline -3 2>$null | ForEach-Object { Write-Output "  $_" }
Write-Output "--- END GIT ---"

Write-Output ""
Write-Output $sep
Write-Output "  ACTION: Read MEMORY.md + STATE.md before starting work"
Write-Output $sep
Write-Output ""

exit 0
