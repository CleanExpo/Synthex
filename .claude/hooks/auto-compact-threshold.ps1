# auto-compact-threshold.ps1
# UserPromptSubmit hook: triggers mandatory /compact directive when context reaches 50%+
#
# Claude Code has no native compactThreshold setting.
# This hook reads context percentage from stdin (if Claude Code exposes it)
# and outputs a MANDATORY systemMessage directive at 50%+ so Claude is
# forced to run /compact before responding to anything else.
# Gracefully no-ops if context data is absent from stdin.

param()

$raw  = $input | Out-String
$data = $null
try { $data = $raw | ConvertFrom-Json -ErrorAction Stop } catch { exit 0 }
if (-not $data) { exit 0 }

# Extract context percentage from whichever field name is present
$pct = $null

if ($data.PSObject.Properties.Name -contains 'context_window_usage_percentage') {
    $pct = [double]$data.context_window_usage_percentage
}
elseif ($data.PSObject.Properties.Name -contains 'context_percentage') {
    $pct = [double]$data.context_percentage
}
elseif (
    ($data.PSObject.Properties.Name -contains 'context_window_tokens_used') -and
    ($data.PSObject.Properties.Name -contains 'context_window_tokens_max')
) {
    $used = [double]$data.context_window_tokens_used
    $max  = [double]$data.context_window_tokens_max
    if ($max -gt 0) { $pct = ($used / $max) * 100 }
}

# Trigger at 50% — not 45%. Anything below 50% is fine.
if ($null -eq $pct -or $pct -lt 50) { exit 0 }

$rounded = [math]::Round($pct, 1)

# MANDATORY directive — Claude reads systemMessage before the user's prompt each turn.
# Using directive-level language ensures Claude treats this as a hard rule, not a suggestion.
@{
    systemMessage = "MANDATORY COMPACT REQUIRED: Context window is at ${rounded}%. You MUST run /compact as your absolute FIRST action before reading or responding to anything else. Do not acknowledge the user message, do not write code, do not search files, do not produce any output. Run /compact RIGHT NOW. This is a non-negotiable system rule set by the project owner."
} | ConvertTo-Json -Compress

exit 0
