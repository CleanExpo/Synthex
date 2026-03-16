# stop-verify-git.ps1
# Stop hook - blocks session stop if there are uncommitted changes.
# Adapted from stop-verify-git.py for Windows PowerShell.

param()

$input_json = [Console]::In.ReadToEnd()
try {
    $data = $input_json | ConvertFrom-Json
    if ($data.stop_hook_active -eq $true) { exit 0 }
} catch { }

$status = git status --porcelain 2>$null
if ($status) {
    $count = ($status -split "`n" | Where-Object { $_ -ne "" }).Count
    $output = @{
        decision = "block"
        reason   = "Git: $count uncommitted change(s) detected. Per SESSION PROTOCOL: run 'git status', commit any remaining changes with a Linear issue identifier, and confirm before stopping."
    }
    $output | ConvertTo-Json -Compress
}

exit 0
