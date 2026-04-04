# Claude Code Infrastructure for SYNTHEX

## Task Runner (Autonomous Mode)

Runs headlessly through Linear Backlog issues automatically.

**Setup:**
```bash
export LINEAR_API_KEY=your_key_from_linear_settings
```

**Run:**
```bash
bash .claude/task-runner.sh
```

**What it does:**
1. Fetches next Backlog issue from Linear (Synthex project, by priority)
2. Runs Claude Code headlessly with the issue as context
3. Commits changes with issue identifier
4. Updates Linear issue to Done
5. Loops until no Backlog issues remain or MAX_ISSUES reached
6. Waits 1 hour on rate limit, then resumes

**Logs:** `.claude/task-runner.log`

---

## Scratchpad

`.claude/scratchpad/current-session.md` — session progress, survives context compaction. Gitignored.

Use for:
- Resuming interrupted work across sessions
- Writing progress checkpoints every 10 tool calls
- Recording current issue and next steps

Clear at end of session (delete contents, keep file).

---

## Settings

`.claude/settings.json` — project-level Claude Code configuration:
- `permissions` — allowed/denied bash commands
- `mcpServers` — Linear MCP HTTP transport (auto-connects each session)
- `hooks` — PostToolUse (file change reminders) + Stop (session end checklist)
- `commands` — slash commands: `/bootstrap`, `/new-feature`, `/verify`, `/audit`, `/fix-types`

---

## Skills

`.claude/skills/` — 18 domain skills auto-triggered by context:
- `auth-patterns` — 4-layer auth architecture
- `content-pipeline` — AI content generation flow
- `social-integrations` — 9-platform OAuth + webhooks
- Plus 15 others — see skill YAML frontmatter for triggers

---

## MCP Servers

Linear MCP connected via HTTP transport. Authenticates via browser OAuth on first use.

To reconnect: run `/mcp` inside Claude Code.
