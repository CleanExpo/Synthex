# SYN-988 - One-shot Cursor pre-bash hook diagnostic + smoke test
# Run in Windows PowerShell:
#   cd d:\Synthex
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\fix-and-test-cursor-hooks.ps1

$ErrorActionPreference = 'Stop'
$RepoRoot = 'd:\Synthex'
if (Test-Path $RepoRoot) {
  Set-Location $RepoRoot
} else {
  Write-Error "Repo not found: $RepoRoot"
}

Write-Host ''
Write-Host '=== Synthex Cursor hook test (SYN-988) ===' -ForegroundColor Cyan
Write-Host ''

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Error 'node not on PATH. Install Node 22+ or open a shell where node works.'
}
Write-Host "Node: $($nodeCmd.Source)"
& node --version

$hook = Join-Path $PWD '.cursor\hooks\pre-bash-validate.cjs'
$hooksJson = Join-Path $PWD '.cursor\hooks.json'
if (-not (Test-Path $hook)) { Write-Error "Missing: $hook" }
if (-not (Test-Path $hooksJson)) { Write-Error "Missing: $hooksJson" }

Write-Host "Hook: $hook"
Write-Host "Config: $hooksJson"
Write-Host ''

function Invoke-CursorHook {
  param(
    [string]$PayloadJson,
    [string]$Label
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $nodeCmd.Source
  $psi.Arguments = "`"$hook`""
  $psi.WorkingDirectory = $PWD.Path
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true

  $p = [System.Diagnostics.Process]::Start($psi)
  $p.StandardInput.Write($PayloadJson)
  $p.StandardInput.Close()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()

  if ($stderr.Trim()) {
    Write-Host "  [stderr] $($stderr.Trim())" -ForegroundColor DarkYellow
  }

  if ($p.ExitCode -ne 0) {
    throw "$Label : node exited $($p.ExitCode). stdout=[$stdout]"
  }

  $lines = $stdout -split "`n"
  $line = ($lines | Where-Object { $_.Trim().Length -gt 0 } | Select-Object -Last 1).Trim()
  if (-not $line) {
    throw "$Label : hook produced empty stdout"
  }

  $parsed = $line | ConvertFrom-Json
  if (-not $parsed.permission) {
    throw "$Label : JSON missing permission field. Line=[$line]"
  }

  [PSCustomObject]@{
    Label      = $Label
    Permission = $parsed.permission
    Raw        = $line
  }
}

$tests = @(
  @{ Payload = '{"tool_name":"Shell","tool_input":{"command":"echo ok"}}'; Label = 'allow-echo'; Expect = 'allow' }
  @{ Payload = '{"tool_name":"Shell","tool_input":{"command":"npm run type-check"}}'; Label = 'allow-npm'; Expect = 'allow' }
  @{ Payload = '{"tool_name":"Shell","tool_input":{"command":"git push origin main"}}'; Label = 'warn-git-push'; Expect = 'allow' }
  @{ Payload = '{"tool_name":"Shell","tool_input":{"command":"rm -rf /"}}'; Label = 'deny-rm-rf'; Expect = 'deny' }
)

$failed = 0
foreach ($t in $tests) {
  try {
    $r = Invoke-CursorHook -PayloadJson $t.Payload -Label $t.Label
    if ($r.Permission -ne $t.Expect) {
      Write-Host "FAIL $($t.Label) expected $($t.Expect) got $($r.Permission)" -ForegroundColor Red
      Write-Host "     $($r.Raw)"
      $failed++
    } else {
      Write-Host "PASS $($t.Label) -> $($r.Permission)" -ForegroundColor Green
    }
  } catch {
    Write-Host "FAIL $($t.Label) $($_.Exception.Message)" -ForegroundColor Red
    $failed++
  }
}

Write-Host ''
if ($failed -gt 0) {
  Write-Host "RESULT: $failed test(s) failed." -ForegroundColor Red
  exit 1
}

Write-Host 'RESULT: All hook tests passed. Hook file is OK.' -ForegroundColor Green
Write-Host ''
Write-Host 'If Cursor agent still blocks with pre-bash-allow.cmd:' -ForegroundColor Yellow
Write-Host '  1. Developer: Reload Window'
Write-Host '  2. Settings -> Hooks -> remove OLD entries'
Write-Host '  3. Project hook must match .cursor/hooks.json:'
Write-Host '     node .cursor/hooks/pre-bash-validate.cjs'
Write-Host ''
exit 0
