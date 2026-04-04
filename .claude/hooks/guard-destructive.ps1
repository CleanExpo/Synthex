# guard-destructive.ps1
# PreToolUse hook for Bash -- blocks destructive commands
# Exit 0 = allow, Exit 2 = block

param(
    [string]$ToolInput
)

# Parse the tool input JSON for the command
try {
    $input = $ToolInput | ConvertFrom-Json
    $command = $input.command
} catch {
    # If we can't parse, allow (fail open for non-Bash tools)
    exit 0
}

if (-not $command) { exit 0 }

# Destructive patterns to block
$blockedPatterns = @(
    'git\s+push\s+.*--force',
    'git\s+push\s+-f\b',
    'git\s+reset\s+--hard',
    'git\s+clean\s+-f',
    'git\s+branch\s+-D',
    'rm\s+-rf\s+/',
    'rm\s+-rf\s+\.',
    'rmdir\s+/s\s+/q',
    'Remove-Item\s+.*-Recurse\s+.*-Force',
    'DROP\s+DATABASE',
    'DROP\s+TABLE',
    'DROP\s+SCHEMA',
    'prisma\s+migrate\s+reset',
    'del\s+/s\s+/q'
)

foreach ($pattern in $blockedPatterns) {
    if ($command -match $pattern) {
        Write-Error "BLOCKED: Destructive command detected -- '$command' matches pattern '$pattern'. Use explicit user confirmation to override."
        exit 2
    }
}

# Allow all other commands
exit 0
