# auto-compact-threshold.ps1
# UserPromptSubmit hook: warns when context window reaches 45%+
#
# Claude Code has no native compactThreshold setting.
# This hook reads context percentage from stdin (if Claude Code exposes it)
# and surfaces a systemMessage so the user knows to run /compact.
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

if ($null -eq $pct -or $pct -lt 45) { exit 0 }

$rounded = [math]::Round($pct, 1)
$level   = if ($pct -ge 70) { "CRITICAL" } elseif ($pct -ge 55) { "HIGH" } else { "WARN" }

@{
    systemMessage = "[$level] Context at ${rounded}% -- run /compact now to keep the session fast"
} | ConvertTo-Json -Compress

exit 0
