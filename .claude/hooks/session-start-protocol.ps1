# session-start-protocol.ps1
# SessionStart hook - fires at the start of each Claude Code session
# Prints orientation context to prevent context drift

$sep = "=" * 52

# Prune dispatch dedup store from previous session (entries > 120 min are safe to clear)
$dedupFile = "D:\Synthex\.claude\scratchpad\dispatch-dedup.json"
if (Test-Path $dedupFile) {
    try {
        $raw    = Get-Content $dedupFile -Raw
        $loaded = $raw | ConvertFrom-Json
        $kept   = @{}
        $now    = Get-Date
        $loaded.PSObject.Properties | ForEach-Object {
            try {
                $age = ($now - [DateTime]::Parse($_.Value.firstSeen)).TotalMinutes
                if ($age -lt 120) { $kept[$_.Name] = $_.Value }
            } catch { }
        }
        $kept | ConvertTo-Json -Depth 3 | Set-Content -Path $dedupFile -Encoding UTF8
    } catch { }
}

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

# 6. Environment check - GEMINI_API_KEY required for local demo testing
Write-Output ""
Write-Output "--- ENV CHECK ---"
$envFile = "D:\Synthex\.env.local"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    if ($envContent -match 'GEMINI_API_KEY=[^\s]+') {
        Write-Output "  GEMINI_API_KEY: SET (demo endpoint will work on localhost)"
    } else {
        Write-Output "  WARNING: GEMINI_API_KEY not set in .env.local"
        Write-Output "  /api/demo/analyze will return 503 on localhost without it."
        Write-Output "  Fix: add GEMINI_API_KEY=<key> to D:\Synthex\.env.local"
        Write-Output "  Note: Production Vercel env var is already set -- production is fine."
    }
} else {
    Write-Output "  WARNING: .env.local not found at D:\Synthex\.env.local"
    Write-Output "  Copy .env.example to .env.local and add GEMINI_API_KEY."
    Write-Output "  Demo endpoint (/api/demo/analyze) needs GEMINI_API_KEY to work locally."
}
Write-Output "--- END ENV CHECK ---"

# 7. Chrome extension reminder - must be connected before any browser automation
Write-Output ""
Write-Output "--- CHROME EXTENSION ---"
$nativeHostPath = "C:\Users\Disaster Recovery 4\.claude\chrome\chrome-native-host.bat"
if (Test-Path $nativeHostPath) {
    Write-Output "  Native host: FOUND"
    Write-Output "  ACTION: Open Chrome, check Claude Code extension shows Connected."
    Write-Output "  If Not Connected: click extension icon then Reconnect (or reload extension)."
    Write-Output "  Must be connected BEFORE any browser automation tasks."
} else {
    Write-Output "  Native host: NOT FOUND at expected path"
    Write-Output "  Install: Claude Code settings > Extensions > Claude in Chrome"
}
Write-Output "--- END CHROME EXTENSION ---"

# 8. MCP context note - explains the Disaster Recovery label to prevent confusion
Write-Output ""
Write-Output "--- MCP NOTE ---"
Write-Output "  Supabase MCP appears as Disaster-Recovery-Supabase (name from initial setup)."
Write-Output "  This IS the correct Synthex Supabase project -- all queries go to the right DB."
Write-Output "  To permanently rename: run /mcp remove Disaster-Recovery-Supabase in Claude Code"
Write-Output "  then re-add via /integrations add supabase and name it Synthex-Supabase."
Write-Output "--- END MCP NOTE ---"

Write-Output ""
Write-Output $sep
Write-Output "  ACTION: Read MEMORY.md + STATE.md before starting work"
Write-Output $sep
Write-Output ""

exit 0
