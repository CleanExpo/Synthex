# synthex-hooks

A Claude Code hook pack that keeps any Claude session working on Synthex on the established
build (the vibe-to-leader fleet: `docs/superpowers/specs/2026-10-17-vibe-to-leader-design.md` as
amended by `...-amendments.md`, `DECISIONS.md`, `scripts/fleet/policy.json`, the `BACKLOG.md`
fleet rows) and stops it cutting corners. It uses only the documented hook API
(<https://code.claude.com/docs/en/hooks.md>, <https://code.claude.com/docs/en/hooks-guide.md>,
read 2026-10-18).

Nothing here is installed by being merged. `.claude/settings.json` is a protected path; the
orchestrator installs `core` in a protected-change commit (see Install).

## Hooks

| Event                                                                     | Type                            | File / prompt              | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse` `Bash\|Read\|Write\|Edit\|MultiEdit\|NotebookEdit`           | command, `onFailure: "block"`   | `guard-pretooluse.mjs`     | Runs `evaluate()` from `scripts/fleet/guard.mjs` with `scripts/fleet/policy.json` for role `SYNTHEX_FLEET_ROLE` (default `builder`) on file writes, Bash commands and the write targets a Bash command names. Also denies, for every role: force push (`--force`, `-f`, `--force-with-lease`, `+refspec`), `--no-verify` / `git commit -n` / `HUSKY=0`, `gh pr merge` outside `scripts/fleet/merge-phase.mjs`, `prisma db push` / `migrate deploy`, reading or writing `.env*` (except `.env.example/.sample/.template`), home secret stores, and printing secrets (`printenv`, bare `env`, `gh auth token`, `echo $..._KEY`). Denies with `permissionDecision: "deny"`; allowed calls print nothing. |
| `PreToolUse` `Write\|Edit\|MultiEdit`, `if: "Edit(/app/api/**/route.ts)"` | prompt, `continueOnBlock: true` | inline                     | Denies route changes that return 2xx with empty/placeholder data on a failed or unconfigured read, add a handler without auth before data access, query without organisation/user scoping, or call an image/video provider directly instead of `lib/services/ai/image-generation.ts` (`.claude/rules/real-images-only.md`). The reason goes back to Claude as the tool error so it can fix and continue.                                                                                                                                                                                                                                                                                              |
| `SessionStart`                                                            | command                         | `context-sessionstart.mjs` | Injects the fleet state as `additionalContext`: branch, `origin/main` sha (after a 15 s fetch, or marked as last local ref), which `release-receipts/P*.json` exist on `origin/main`, the next phase and its DoD, open `feature/fleet-*` PRs (read-only `gh pr list`; a failure reads `unknown (gh failed: ...)`, never `none`), halt files (working tree and `origin/main`), the top 5 open BACKLOG fleet rows. Capped at 5000 characters (~1250 tokens).                                                                                                                                                                                                                                            |
| `UserPromptSubmit`                                                        | command                         | `context-userprompt.mjs`   | If `scripts/goals/check-report.mjs` exists, runs it with `--offline` (20 s) and injects only its `Summary` line; if it exists but gives no Summary line, injects an `INCONCLUSIVE` line. If absent, injects nothing. Never blocks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `SubagentStop`                                                            | prompt                          | inline                     | Fleet subagents must end on `UNIT-DONE <unit> <sha> <PASS\|FAIL\|INCONCLUSIVE>`, and PASS must quote the proving command's output; else `ok: false` naming what is missing. `impossible: true` when the work cannot finish in this run. Non-fleet subagents pass.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `TaskCompleted`                                                           | agent                           | inline                     | Evidence-bound completion (`.claude/rules/fabel-evidence-standard.md`): reads the transcript tail and blocks a completion claim that has no supporting tool result.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `Stop` (**forcing**, founder-gated)                                       | agent, timeout 120              | inline                     | Returns `ok: true` at once when `stop_hook_active` is true. Otherwise runs `node scripts/goals/check-report.mjs --offline` (if present) and `node scripts/fleet/phase-advance.mjs --dry-run`, classifies the residual per `goal-circuit-breaker`, and returns `ok: false` with ONE next action only for ACTIONABLE in-bounds work. Founder-gated (DECISIONS OPEN), PC-gated (PR create/merge), external-lane waits and a residual already emitted unchanged all return `ok: true`.                                                                                                                                                                                                                    |

### Why command vs prompt vs agent

- **Command** where the rule is deterministic: the fleet policy, protected paths and forbidden
  commands have exact answers, so no model is involved and they cost nothing. SessionStart only
  supports `command` and `mcp_tool`.
- **Prompt** (one model call, input JSON only) where the evidence is in the hook input: the route
  file content is in `tool_input`, the subagent's final message is in `last_assistant_message`.
  Prompt hooks alone support `continueOnBlock` and `impossible`.
- **Agent** (up to 50 tool turns) where the evidence is outside the input. `TaskCompleted` input
  carries only the task subject and description, so a prompt hook could not see the tool result it
  must judge; the agent reads `transcript_path`. The forcing Stop hook must run the gate scripts.
  This is the one deviation from the unit brief, which listed TaskCompleted as a prompt hook.
- `PostToolBatch` supports agent hooks, but an `ok: false` there ends the turn; nothing in this pack
  needs it, so it is not used.

### Doc facts relied on (hooks reference section names)

- _Hook handler fields / Common fields_: `if` takes one permission rule and is only evaluated on
  tool events; the file-tool rule is `Edit(...)`, which covers Write and MultiEdit (permissions doc:
  "Edit rules apply to all built-in tools that edit files"); `/path` anchors at the project.
- _Command hook fields / Exec form and shell form_: `command` + `args` spawns without a shell and
  substitutes `${CLAUDE_PROJECT_DIR}` in each element.
- _Block the action when a hook fails_: `onFailure: "block"` turns a crash, timeout, missing script
  or exit code other than 0/2 into a block on `PreToolUse` (Claude Code v2.1.295 or later). It has
  no effect on Stop, SubagentStop, TaskCompleted, so it is set only on the guard.
- _PreToolUse decision control_: `hookSpecificOutput.permissionDecision: "deny"` with
  `permissionDecisionReason`; precedence deny > defer > ask > allow; silence does not approve.
- _Add context for Claude_: `hookSpecificOutput.additionalContext` on SessionStart and
  UserPromptSubmit; over 10,000 characters it is spilled to a file, hence the 5000 cap.
- _Prompt-based hooks_: per-event support table; `$ARGUMENTS`; response `{ok, reason, impossible}`;
  `impossible` honoured only on Stop/SubagentStop; `continueOnBlock` on PreToolUse returns the
  reason as the tool error. Default timeout 30 s.
- _Agent-based hooks_: same events as prompt hooks except PermissionRequest; up to 50 turns;
  default timeout 60 s; no `continueOnBlock`, no `impossible`; `ok: false` handled like a prompt
  hook with `continueOnBlock: true`.
- _Stop input_: `stop_hook_active` and the 8-consecutive-continuation cap
  (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`).
- _SessionStart_: only `command` and `mcp_tool` handlers.

## Supersedes `.claude/hooks/pre-bash-validate.py`

That script prints `{"permission":"deny"}`, which is not a documented PreToolUse output field, so
its "blocks" never denied anything. `guard-pretooluse.mjs` replaces it with the documented deny
form. The old file is a protected path and is left untouched; the orchestrator removes its
`PreToolUse` registration in the same protected-change commit that installs `core`, if wanted.

## Limits

- Bash parsing is best effort: a command that writes through a script it runs (`node x.mjs`) is
  not seen. Integration still runs `scripts/fleet/verify-protected.mjs` over every diff; this hook
  stops the attempt earlier, it does not replace that check.
- A builder session cannot run `git push` or `gh` (policy `roles.builder.may_not`). Set
  `SYNTHEX_FLEET_ROLE=orchestrator` (or `releaser`) for sessions holding that role. An orchestrator
  writes a protected path only with `SYNTHEX_PROTECTED_CHANGE=<reason>` set.
- The guard denies a command whose text contains a forbidden string even inside a commit message
  (the policy evaluator matches substrings). Reword the message.
- `transcript_path` is written asynchronously; the agent hooks are told to pass when the claim is
  not yet visible rather than block on a lagging file.

## Install

```bash
node tools/claude-hooks/install.mjs --print            # merged settings to stdout, writes nothing
node tools/claude-hooks/install.mjs --print --forcing  # preview including the forcing Stop hook
SYNTHEX_FLEET_ROLE=orchestrator SYNTHEX_PROTECTED_CHANGE="install synthex-hooks core" \
  node tools/claude-hooks/install.mjs --write --core   # orchestrator only
```

`--write` rewrites only `.claude/settings.json`: existing settings and hooks are preserved, and a
group or handler already present is not added twice (running it twice is a no-op). Commit it
with trailers `Fleet-Role: orchestrator` and `Protected-Change: <reason>` (policy
`protected_exemptions.orchestrator_protected_change`). Restart the session or open `/hooks` to
load it. Requires Claude Code v2.1.295 or later for `onFailure`.

## Founder gate for the forcing Stop hook

Global rule: installing a forcing Stop hook requires the founder's explicit Bash permission rule;
ordinary hook repair cannot supply that authority. `install.mjs --write --forcing` therefore exits
3 and writes nothing unless `SYNTHEX_FOUNDER_STOP_HOOK_APPROVED=1` is set, and that variable must
only be set after the founder has added the permission rule. No agent sets it on its own.

## Cost

Command hooks run locally and cost nothing. Prompt and agent hooks run on the model Claude Code
uses for background functionality, inside the existing subscription; no new paid product, key or
service. The route prompt runs only on `app/api/**/route.ts` edits; SubagentStop and TaskCompleted
run once per event; the forcing Stop agent (up to 120 s) runs once per stop and passes at once
on a continued stop.

## Tests

`npx jest --config config/jest/jest.worktree.cjs tests/unit/claude-hooks` feeds recorded hook
input to each command hook and asserts the exact output and exit code, and checks
`hooks.settings.json` against the per-event support table.
