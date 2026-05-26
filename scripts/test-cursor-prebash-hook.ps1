# Smoke test for .cursor/hooks/pre-bash-validate.cjs (SYN-988)
# Run from repo root: powershell -File scripts/test-cursor-prebash-hook.ps1

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$hook = (Resolve-Path '.cursor\hooks\pre-bash-validate.cjs').Path
if (-not (Test-Path $hook)) {
  Write-Error "Missing hook: $hook"
}

function Invoke-PreBashHook {
  param([string]$Payload)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'node'
  $psi.Arguments = "`"$hook`""
  $psi.WorkingDirectory = $PWD.Path
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  [void]$proc.Start()
  $proc.StandardInput.Write($Payload)
  $proc.StandardInput.Close()
  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()

  if ($stderr.Trim()) {
    Write-Warning "hook stderr: $($stderr.Trim())"
  }
  if ($proc.ExitCode -ne 0) {
    throw "node exit $($proc.ExitCode). stdout=$stdout stderr=$stderr"
  }

  $line = ($stdout -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 1).Trim()
  if (-not $line) {
    throw "empty stdout from hook"
  }
  try {
    return $line | ConvertFrom-Json
  } catch {
    throw "invalid JSON on stdout: $line"
  }
}

function Test-Hook {
  param([string]$Payload, [string]$Label, [string]$Expect = 'allow')
  $result = Invoke-PreBashHook -Payload $Payload
  if ($result.permission -ne $Expect) {
    Write-Error "$Label : expected permission=$Expect got $($result.permission)"
  }
  Write-Host "PASS $Label -> $($result.permission)"
}

Test-Hook '{"tool_name":"Shell","tool_input":{"command":"echo ok"}}' 'allow-echo'
Test-Hook '{"tool_name":"Shell","tool_input":{"command":"npm run type-check"}}' 'allow-npm'
Test-Hook '{"tool_name":"Shell","tool_input":{"command":"git push origin main"}}' 'warn-push' 'allow'
Test-Hook '{"tool_name":"Shell","tool_input":{"command":"rm -rf /"}}' 'deny-rm-rf' 'deny'

Write-Host 'All hook smoke tests passed.'
