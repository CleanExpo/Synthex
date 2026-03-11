# pre-agent-dispatch.ps1
# PreToolUse hook - fires before Task tool spawns a subagent
# Non-blocking: exits 0 always. Logs warnings to scratchpad.

$scratchpadDir = "D:\Synthex\.claude\scratchpad"
$logFile = "$scratchpadDir\agent-dispatch-log.md"

# Ensure scratchpad exists
if (-not (Test-Path $scratchpadDir)) {
    New-Item -ItemType Directory -Path $scratchpadDir | Out-Null
}

$toolInput = $env:TOOL_INPUT
if (-not $toolInput) { exit 0 }

# Parse JSON input
try {
    $parsed = $toolInput | ConvertFrom-Json
} catch {
    exit 0
}

$subagentType = $parsed.subagent_type
$description  = $parsed.description
$prompt       = $parsed.prompt

# ── DEDUP: Idempotency key generation + duplicate dispatch detection ──────────
$dedupFile = "$scratchpadDir\dispatch-dedup.json"

# Generate idempotency key: SHA256(subagent_type|first-200-chars-of-description)
$descTrimmed = if ($description) { $description.Substring(0, [Math]::Min(200, $description.Length)) } else { "" }
$keySource = (($subagentType + "|" + $descTrimmed).ToLower().Trim())
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$bytes  = [System.Text.Encoding]::UTF8.GetBytes($keySource)
$hash   = [System.BitConverter]::ToString($sha256.ComputeHash($bytes)).Replace("-","").ToLower()
$idempotencyKey = $hash.Substring(0, 16)

# Load or init dedup store
$dedup = @{}
if (Test-Path $dedupFile) {
    try {
        $raw    = Get-Content $dedupFile -Raw
        $loaded = $raw | ConvertFrom-Json
        $loaded.PSObject.Properties | ForEach-Object { $dedup[$_.Name] = $_.Value }
    } catch { $dedup = @{} }
}

# Check for duplicate within 30-minute window
$isDuplicate = $false
$now = Get-Date
if ($dedup.ContainsKey($idempotencyKey)) {
    $firstSeen = [DateTime]::Parse($dedup[$idempotencyKey].firstSeen)
    $ageMins   = ($now - $firstSeen).TotalMinutes
    if ($ageMins -lt 30) {
        $isDuplicate = $true
        $count = $dedup[$idempotencyKey].count + 1
        $dedup[$idempotencyKey].count = $count
        Write-Error ("DUPLICATE_DISPATCH [key=$idempotencyKey count=$count age=" + [math]::Round($ageMins,1) + "min]: " +
            "Agent '$subagentType' description '$description' was dispatched $count times in " + [math]::Round($ageMins,1) + "min. " +
            "Check if a Linear issue was already created for this work before proceeding.")
    }
}

# Register key if first time seen
if (-not $dedup.ContainsKey($idempotencyKey)) {
    $dedup[$idempotencyKey] = [PSCustomObject]@{
        firstSeen = $now.ToString("o")
        count     = 1
        agent     = $subagentType
        desc      = $descTrimmed.Substring(0, [Math]::Min(80, $descTrimmed.Length))
    }
}

# Prune entries older than 60 minutes to keep store lean
$pruned = @{}
foreach ($k in $dedup.Keys) {
    try {
        $age = ($now - [DateTime]::Parse($dedup[$k].firstSeen)).TotalMinutes
        if ($age -lt 60) { $pruned[$k] = $dedup[$k] }
    } catch { }
}
$dedup = $pruned

# Persist dedup store
try {
    $dedup | ConvertTo-Json -Depth 3 | Set-Content -Path $dedupFile -Encoding UTF8
} catch { }  # non-fatal — hook must not crash
# ── END DEDUP ─────────────────────────────────────────────────────────────────

$warnings = @()
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"

# Validation 1: Linear issue ID present
$hasIssue = ($prompt -match "UNI-\d+") -or ($description -match "UNI-\d+")
if (-not $hasIssue) {
    $warnings += "WARN: No Linear issue ID (UNI-XXXX) found in task. All work must trace to an issue."
}

# Validation 2: Known agent type
$knownAgents = @("build-engineer","code-architect","qa-sentinel","senior-reviewer",
                  "general-purpose","Explore","Plan","claude-code-guide",
                  "javascript-typescript:typescript-pro","javascript-typescript:javascript-pro",
                  "seo-geo-master","seo-visual","seo-sitemap","seo-schema")
if ($subagentType -and ($knownAgents -notcontains $subagentType)) {
    $warnings += ("WARN: Unregistered agent type '" + $subagentType + "'. Check AGENT-REGISTRY.md.")
}

# Validation 3: Prompt length (context budget)
if ($prompt -and $prompt.Length -gt 8000) {
    $warnings += ("WARN: Prompt length " + $prompt.Length + " chars. Consider trimming for subagent context budget.")
}

# Log dispatch
$logEntry = @()
$logEntry += ""
$logEntry += ("## Dispatch - " + $timestamp)
$logEntry += ("Agent: " + $subagentType)
$logEntry += ("Description: " + $description)
$logEntry += ("Issue ID present: " + $hasIssue)
$logEntry += ("Duplicate: " + $isDuplicate)
if ($warnings.Count -gt 0) {
    foreach ($w in $warnings) { $logEntry += $w }
}

$logEntry | Add-Content -Path $logFile -Encoding UTF8

# Surface warnings to stderr (displayed in Claude Code output)
if ($warnings.Count -gt 0) {
    foreach ($w in $warnings) {
        Write-Error $w
    }
}

exit 0
