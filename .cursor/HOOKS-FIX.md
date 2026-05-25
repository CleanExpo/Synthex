# Cursor hooks — Windows fix (SYN-971 workspace)

**Skill:** `.claude/skills/cursor-hooks-windows/SKILL.md` — full playbook for agents.

## Error

```text
Hook beforeShellExecution returned stdout that is not valid JSON
... hooks-allow.bat
```

## Cause

`hooks-allow.bat` used plain `echo` while Cursor **pipes JSON on stdin**. On Windows that often yields **empty hook stdout** → block.

## Fix applied

- `hooks-allow.bat` → drains stdin via `node allow-hook.cjs` (or PowerShell fallback)
- 1Password plugin `hooks/hooks.json` → `./scripts/hooks-allow.bat`, `failClosed: false`
- Project `.cursor/hooks.json` → `.cursor/hooks/hooks-allow.bat`

## You must still do this once

1. **Cursor Settings → Hooks** — remove stale entries (`validate-mounted-env-files.sh`, old `.ps1` paths).
2. **Developer: Reload Window**.
3. Test: `Set-Location d:\Synthex; npm run type-check`

If the error persists, disable **1Password** under **Settings → Plugins**, reload, test again.
