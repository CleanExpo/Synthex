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

## Fix applied (SYN-988, 2026-05-25)

- `.cursor/hooks.json` → `node .cursor/hooks/pre-bash-validate.cjs` (no `.cmd` wrapper in JSON — avoids empty stdout on Windows)
- `pre-bash-validate.cjs` → drains stdin; stdout is **only** `{"permission":"allow"}` or deny object (no extra fields)
- `pre-bash-allow.cmd` → fallback wrapper with PowerShell if `node` missing on PATH
- Smoke test: `powershell -File scripts/test-cursor-prebash-hook.ps1`
- Optional hook log: `$env:SYNTHEX_HOOK_LOG = "1"` → `.claude/scratchpad/hook-events.jsonl`
- Legacy: `hooks-allow.bat` / `pre-bash-validate.py` — do not point Cursor Settings at these

## You must still do this once

1. **Cursor Settings → Hooks** — remove any entry whose command contains `$CLAUDE_PROJECT_DIR` or `python3 .../pre-bash-validate.py` (Cursor does not expand `$CLAUDE_PROJECT_DIR` → invalid JSON).
2. Project hook should be **only**: `.cursor/hooks/pre-bash-allow.cmd` (see `.cursor/hooks.json`).
3. **Developer: Reload Window**.
4. Test: `powershell -File scripts/test-cursor-prebash-hook.ps1` (must show four PASS lines)
5. Then: `npm run type-check` in agent or terminal

If the error persists, disable **1Password** under **Settings → Plugins**, reload, test again.
