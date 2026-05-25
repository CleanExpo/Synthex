# Cursor hooks — Windows fix (SYN-971 workspace)

**Skill:** `.claude/skills/cursor-hooks-windows/SKILL.md` — full playbook for agents.

## Errors

### beforeShellExecution

```text
Hook beforeShellExecution returned stdout that is not valid JSON
... hooks-allow.bat
```

### preToolUse (Bash validator)

```text
Hook preToolUse returned stdout that is not valid JSON
... pre-bash-validate.py
```

## Cause

Hooks must **read stdin** (hook payload) and write **only valid JSON** to stdout.

| Broken pattern                                               | Why it fails                               |
| ------------------------------------------------------------ | ------------------------------------------ |
| `echo {"permission":"allow"}` in `.bat` with piped stdin     | Often **empty stdout** on Windows          |
| `pre-bash-validate.py` exiting 0 with **no stdout** on allow | Cursor parses empty output as invalid JSON |
| `print()` warnings to stdout in Python                       | Corrupts JSON parse                        |

## Fix applied

- `hooks-allow.bat` → drains stdin via `node allow-hook.cjs` (or PowerShell fallback)
- `pre-bash-validate.py` → always emits `{"permission":"allow"}` or `{"permission":"deny",...}` on stdout
- `.claude/settings.json` PreToolUse → `pre-bash-validate.ps1` on Windows (same JSON contract)
- Fallback: `pre-bash-validate.cmd` → `python -u` or PowerShell
- 1Password plugin `hooks/hooks.json` → `./scripts/hooks-allow.bat`, `failClosed: false`
- Project `.cursor/hooks.json` → `.cursor/hooks/hooks-allow.bat`

## You must still do this once

1. **Cursor Settings → Hooks** — remove any entry whose command contains `$CLAUDE_PROJECT_DIR` or `python3 .../pre-bash-validate.py` (Cursor does not expand `$CLAUDE_PROJECT_DIR` → invalid JSON).
2. Project hook should be **only**: `.cursor/hooks/pre-bash-allow.cmd` (see `.cursor/hooks.json`).
3. **Developer: Reload Window**.
4. Test: `Set-Location d:\Synthex; npm run type-check`

If the error persists, disable **1Password** under **Settings → Plugins**, reload, test again.
