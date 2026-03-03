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
