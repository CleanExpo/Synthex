# pre-bash-validate.ps1
# PreToolUse(Bash) hook - blocks catastrophic commands, warns on risky ones.
# Adapted from pre-bash-validate.py for Windows PowerShell.

param()

$input_json = [Console]::In.ReadToEnd()
try {
    $data = $input_json | ConvertFrom-Json
} catch { exit 0 }

if ($data.tool_name -ne "Bash") { exit 0 }
$command = $data.tool_input.command
if (-not $command) { exit 0 }

# Patterns that are always blocked
$blocked = @(
    @{ pattern = 'rm\s+-rf\s+/(\s|$)';        msg = "BLOCKED: 'rm -rf /' would delete the entire filesystem" },
    @{ pattern = 'rm\s+-rf\s+~';               msg = "BLOCKED: 'rm -rf ~' would delete the home directory" },
    @{ pattern = 'sudo\s+rm\s+-rf';            msg = "BLOCKED: sudo rm -rf is extremely dangerous" },
    @{ pattern = ':\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}'; msg = "BLOCKED: fork bomb detected" },
    @{ pattern = '>\s*/dev/sd[a-z]';           msg = "BLOCKED: direct write to disk device" },
    @{ pattern = 'mkfs\.';                     msg = "BLOCKED: filesystem formatting command" },
    @{ pattern = 'dd\s+if=.*of=/dev/';         msg = "BLOCKED: direct disk write with dd" },
    @{ pattern = 'DROP\s+DATABASE';            msg = "BLOCKED: DROP DATABASE requires explicit human confirmation" }
)

foreach ($b in $blocked) {
    if ($command -imatch $b.pattern) {
        [Console]::Error.WriteLine($b.msg)
        exit 2
    }
}

# Patterns that warn
$warnings = @(
    @{ pattern = 'git\s+push\s+(--force|-f)'; msg = "WARNING: force push requires explicit human confirmation per TOOL CONSTRAINTS" },
    @{ pattern = 'git\s+push\b';              msg = "WARNING: git push requires explicit human confirmation - confirm with user first" },
    @{ pattern = 'rm\s+-rf\s+\S+';            msg = "WARNING: rm -rf is destructive - verify path is correct" },
    @{ pattern = 'git\s+reset\s+--hard';      msg = "WARNING: hard reset discards uncommitted changes" },
    @{ pattern = 'npm\s+install\s+--force';   msg = "WARNING: --force bypasses security checks" },
    @{ pattern = 'chmod\s+777';               msg = "WARNING: chmod 777 is overly permissive" }
)

$hits = @()
foreach ($w in $warnings) {
    if ($command -match $w.pattern) { $hits += $w.msg }
}

if ($hits.Count -gt 0) {
    $output = @{
        hookSpecificOutput = @{
            hookEventName     = "PreToolUse"
            additionalContext = ($hits -join " | ")
        }
    }
    $output | ConvertTo-Json -Compress
}

exit 0
