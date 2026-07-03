# Pushes generative-video-engine secrets from .env.local into Vercel
# (Preview + Production) for the synthex project, via the Vercel REST API.
#
# Uses PowerShell's Invoke-RestMethod (Windows Schannel -> trusts the corporate
# proxy), so it sidesteps the Node CLI's TLS + stderr problems entirely.
#
# Run it yourself:
#   ! powershell -ExecutionPolicy Bypass -File D:/Synthex/scripts/push-env-to-vercel.ps1
#
# Reads your already-stored Vercel token from the CLI's auth file. Secrets are
# read from .env.local and sent over HTTPS; nothing is printed to the console.

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$PROJECT = 'prj_gbQmHn6quoHgG3AswRrDoUlYaF40'   # synthex
$TEAM    = 'team_KMZACI5rIltoCRhAtGCXlxUf'      # unite-group

# --- locate the Vercel token (your own credential, your own shell) ---
$token = $env:VERCEL_TOKEN
if (-not $token) {
  foreach ($p in @(
    "$env:USERPROFILE\.vercel\auth.json",
    "$env:LOCALAPPDATA\com.vercel.cli\auth.json",
    "$env:APPDATA\com.vercel.cli\auth.json"
  )) {
    if (Test-Path $p) {
      try { $j = Get-Content $p -Raw | ConvertFrom-Json } catch { continue }
      if ($j.token) { $token = $j.token; break }
    }
  }
}
if (-not $token) {
  Write-Host "No Vercel token found. Run 'vercel login' once, then re-run this script." -ForegroundColor Red
  exit 1
}
$headers = @{ Authorization = "Bearer $token" }

# --- confirm auth + project ---
try {
  $proj = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$PROJECT`?teamId=$TEAM" -Headers $headers -TimeoutSec 30
  Write-Host "Authenticated. Project: $($proj.name)" -ForegroundColor Green
} catch {
  $code = try { [int]$_.Exception.Response.StatusCode } catch { 0 }
  Write-Host "Auth/project check failed (HTTP $code). Token may be expired - run 'vercel login'." -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}

# --- read .env.local ---
$envFile = 'D:\Synthex\.env.local'
if (-not (Test-Path $envFile)) { Write-Host ".env.local not found" -ForegroundColor Red; exit 1 }
$raw = Get-Content $envFile -Raw
function Get-EnvVal([string]$name) {
  $m = [regex]::Match($raw, "(?m)^$([regex]::Escape($name))=(.+)$")
  if (-not $m.Success) { return $null }
  return $m.Groups[1].Value.Trim().Trim('"')
}

# name => literal override (or $null to read from .env.local)
$targets = [ordered]@{
  'FAL_API_KEY'             = $null
  'FAL_WEBHOOK_SECRET'      = $null
  'SYNTHEX_MCP_KEYS'        = $null
  'CRON_SECRET_VIDEO_SWEEP' = $null
  'VIDEO_STUDIO_ENABLED'    = 'true'
  'ELEVENLABS_API_KEY'      = $null
  'ELEVENLABS_VOICE_ID'     = $null
}

$ok = 0; $fail = 0
foreach ($name in $targets.Keys) {
  $val = if ($targets[$name]) { $targets[$name] } else { Get-EnvVal $name }
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host "SKIP $name (empty in .env.local)" -ForegroundColor Yellow
    continue
  }
  $body = @{
    key    = $name
    value  = $val
    type   = 'encrypted'
    target = @('preview','production')
  } | ConvertTo-Json -Compress
  try {
    # upsert=true overwrites any existing value for the same key+target
    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$PROJECT/env?upsert=true&teamId=$TEAM" `
      -Method POST -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 30 | Out-Null
    Write-Host "  set $name [preview+production] (len=$($val.Length))" -ForegroundColor Green
    $ok++
  } catch {
    $code = try { [int]$_.Exception.Response.StatusCode } catch { 0 }
    Write-Host "  FAILED $name (HTTP $code)" -ForegroundColor Red
    $fail++
  }
}

Write-Host "`nEnv vars: $ok set, $fail failed." -ForegroundColor Cyan
if ($fail -eq 0) {
  Write-Host "All set. Tell Claude 'env vars are in' - it will trigger the redeploy and run the smoke test." -ForegroundColor Cyan
}
