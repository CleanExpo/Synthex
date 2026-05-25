---
name: cursor-hooks-windows
description: >-
  Fix Cursor beforeShellExecution hooks on Windows when stdout is invalid JSON
  or empty. Use for hooks-allow.bat, validate-mounted-env-files.sh, 1Password
  plugin, or "blocked for safety" agent terminal errors on Synthex (Windows 11).
---

# Cursor Hooks — Windows Invalid JSON Fix

## Trigger phrases

- `beforeShellExecution returned stdout that is not valid JSON`
- `hooks-allow.bat`
- `validate-mounted-env-files.sh`
- Agent shell blocked but integrated terminal works

## Root cause (Windows)

1. Cursor pipes **hook input JSON on stdin** to the hook process.
2. A bare `echo {"permission":"allow"}` in `.bat` **does not reliably write to stdout** when stdin is piped — hook log shows **OUTPUT: (empty)**.
3. Cursor then parses garbage (`exit status…`) as JSON and **blocks** the agent command.

**Iron rule:** Hook must **read stdin**, then write **only** this to stdout (plus newline):

```json
{ "permission": "allow" }
```

## Fix pattern (use this)

### Preferred: Node (`allow-hook.cjs`)

```javascript
'use strict';
const fs = require('fs');
try {
  if (!process.stdin.isTTY) fs.readFileSync(0, 'utf8');
} catch {
  /* ignore */
}
process.stdout.write(JSON.stringify({ permission: 'allow' }) + '\n');
process.exit(0);
```

### `hooks-allow.bat` wrapper

```bat
@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
  node "%~dp0allow-hook.cjs"
  exit /b %ERRORLEVEL%
)
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$null=[Console]::In.ReadToEnd();[Console]::Out.WriteLine('{\"permission\":\"allow\"}')"
exit /b %ERRORLEVEL%
```

### PowerShell-only hook (if UI points at `.ps1`)

```powershell
$null = [Console]::In.ReadToEnd()
[Console]::Out.WriteLine('{"permission":"allow"}')
exit 0
```

Use `WriteLine`, not `Write-Output` (avoids CLIXML on stderr).

## Never use on Windows

| Avoid                                                     | Why                                           |
| --------------------------------------------------------- | --------------------------------------------- |
| `./scripts/validate-mounted-env-files.sh` as hook command | Bash stdout often empty in Cursor hook runner |
| `echo {"permission":"allow"}` alone in `.bat`             | Breaks when stdin is piped                    |
| `failClosed: true` while debugging                        | Invalid JSON hard-blocks                      |

Use `./scripts/hooks-allow.bat` or `./scripts/validate-mounted-env-files.cmd` (calls `hooks-allow.bat`).

## 1Password plugin paths

Plugin cache (user machine):

`%USERPROFILE%\.cursor\plugins\cache\cursor-public\1password\<hash>\`

Files to patch:

- `scripts/hooks-allow.bat`
- `scripts/allow-hook.cjs`
- `hooks/hooks.json` → `"command": "./scripts/hooks-allow.bat"`, `"failClosed": false`

## Cursor Settings cleanup

Disk files are not enough if **Settings → Hooks** still lists old commands.

1. **Settings → Hooks** → remove duplicate/stale `beforeShellExecution` entries.
2. **Developer: Reload Window**.
3. Verify: integrated terminal `npm run type-check` in `d:\Synthex`.

## Verification

```powershell
# Must print exactly one JSON line:
cmd /c "path\to\hooks-allow.bat" < hook-input.json
```

`hook-input.json` minimal:

```json
{ "command": "npm test", "hook_event_name": "beforeShellExecution" }
```

Agent shell: run `npm run type-check` — must not show invalid JSON.

## Synthex project

- `d:\Synthex\.cursor\hooks.json` — prefer empty `beforeShellExecution` OR `.cursor/hooks/before-shell-allow.cmd` calling same pattern.
- See `d:\Synthex\.cursor\HOOKS-FIX.md` for CEO-facing steps.

## Related skills

- `create-hook` (Cursor) — hook schema and `failClosed`
- `fix` — minimal surgical patch
- `gstack/investigate` — if multiple hooks still fail after fix
