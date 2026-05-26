# CLAUDE.md full restore (SYN-988)

If root `CLAUDE.md` is corrupted, restore from git then re-apply the SYN-988 line in SKILL AUTO-SELECTION:

```powershell
cd d:\Synthex
New-Item -ItemType Directory -Force -Path .claude\archived\2026-05-25
Move-Item -Force CLAUDE.md .claude\archived\2026-05-25\CLAUDE.md.corrupted
git show origin/main:CLAUDE.md | Set-Content -Encoding utf8 CLAUDE.md
```

If `origin/main` version is also bad, use last good commit:

```powershell
git log -10 --oneline -- CLAUDE.md
git show <commit>:CLAUDE.md | Set-Content -Encoding utf8 CLAUDE.md
```

Add under **SKILL AUTO-SELECTION**:

```markdown
**Agent stack (May 2026):** `.cursor/rules/agent-stack.mdc` · plan `docs/superpowers/plans/2026-05-25-agent-stack-cursor-upgrade.md` · Linear **SYN-988**
```

Add under **COMMANDS**:

```markdown
**Cursor hook smoke:** `powershell -File scripts/test-cursor-prebash-hook.ps1`
```

Add to skills table: `| Cursor hooks (Windows) | cursor-hooks-windows |`

Add to KEY DIRECTORIES: `| .cursor/rules/ | Cursor agent rules including agent-stack.mdc |`

Full canonical text matches the workspace `CLAUDE.md` rule in Cursor settings (session protocol through Continual Learning). This file documents the restore procedure only.
