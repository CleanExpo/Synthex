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

Check ids H1-H15 come from `docs/research/2026-10-18-next-level.md` section (d) (branch
`fleet-unit/research/next-level`). Every command check has a planted positive control in
`selftest.mjs`.

**Core** (safe for the orchestrator to install):

| Event (matcher)                                                             | Type                            | File                          | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreToolUse` (`*`)                                                          | command, `onFailure: "block"`   | `guard-pretooluse.mjs`        | **H1** denies only with `hookSpecificOutput.permissionDecision: "deny"`; a crash exits 1 and blocks. **H3** `scripts/fleet/guard.mjs` `evaluate()` with the policy for role `SYNTHEX_FLEET_ROLE` (default `builder`) on file writes, Bash commands and the targets a Bash command writes (redirects, `cp`, `mv`, `rm`, `tee`, `sed -i`, `git checkout --`). **H4** `git push` only to `fleet-unit/**`, `fix/**`, `feature/fleet-p*`; no `--force`/`-f`/`--force-with-lease`/`+refspec`, `--no-verify`, `--delete`/`:ref`, tags, `--all`/`--mirror`; no `gh pr merge` (FD-3). **H5** `git commit` needs committer `Synthex Fleet <fleet@synthex.local>` (from `GIT_COMMITTER_*`, `-c user.*` or git config) and a `Fleet-Role:` trailer in `-m`, `-F file`, `-F -` heredoc or `--trailer`. **H6** secret patterns in new content or a Bash command (Stripe live keys, PEM private keys, AWS, GitHub, Slack, Google, Anthropic, OpenAI-style keys, passworded DB URLs), `.env*` reads and writes (except `.env.example/.sample/.template`), home secret stores, printing the environment or secret-named variables. **H7** `prisma migrate deploy/reset`, `prisma db push`, `supabase db push/reset`, `vercel --prod/deploy/env/promote/alias`, a non-local `DATABASE_URL`/`DIRECT_URL`. **H8** a `floors.json` edit may not lower or remove any numeric floor; Bash writes to it are denied. **H9** while `release-receipts/halt/STOP` or `STOP-<today>` exists, only Read/Grep/Glob and read-only commands run. **H13** with `SYNTHEX_FLEET_ROLE=builder`, WebFetch, WebSearch and fetch/search/browser MCP tools are denied. |
| `PreToolUse` (`Write\|Edit\|MultiEdit`), `if: "Edit(/app/api/**/route.ts)"` | prompt, `continueOnBlock: true` | inline                        | Denies route changes that return 2xx with empty/placeholder data on a failed or unconfigured read, add a handler without auth before data access, query without organisation/user scoping, or call an image/video provider directly instead of `lib/services/ai/image-generation.ts` (`.claude/rules/real-images-only.md`). The reason goes back to Claude as the tool error.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `PostToolUse` (`Write\|Edit\|MultiEdit`)                                    | command, `onFailure: "block"`   | `lint-n1.mjs`                 | **H15** advisory N1 lint: an email template with no unsubscribe/opt-out, or a trade ad (campaign/ad path plus a trade term) with no licence number, gets a warning (`additionalContext` and `systemMessage`). Never blocks; the tool already ran.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `PermissionDenied` (`*`)                                                    | command, `onFailure: "block"`   | `permission-denied.mjs`       | **H11** appends one JSON row per auto-mode denial to the policy ledger (`release-receipts/ledger/fleet.jsonl`), secrets redacted. The hook writes it, never a builder. Never returns `retry`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `ConfigChange` (`project_settings\|local_settings\|skills`)                 | command, `onFailure: "block"`   | `config-change.mjs`           | **H10** blocks project/local settings and skill-file changes mid-session (`{"decision":"block"}`), except with `SYNTHEX_HOOK_INSTALL=1` in Claude Code's environment, or when the file holds exactly the content `install.mjs --write` wrote in the last 5 minutes (temp-dir marker with its sha256).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `SessionStart`                                                              | command                         | `context-sessionstart.mjs`    | Fleet state as `additionalContext`: branch, `origin/main` sha, receipts on `origin/main`, next phase and DoD, open `feature/fleet-*` PRs (a `gh` failure reads `unknown (gh failed: ...)`, never `none`), halt files, top 5 open BACKLOG fleet rows. **H2** a hook-health line: `claude --version` against the 2.1.295 floor, and every command hook on PreToolUse/PermissionRequest/ConfigChange in `.claude/settings.json` must set `onFailure: "block"`. Reports only, never blocks a session. Capped at 5000 characters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `UserPromptSubmit`                                                          | command                         | `context-userprompt.mjs`      | If `scripts/goals/check-report.mjs` exists, runs it with `--offline` (20 s) and injects only its `Summary` line (`INCONCLUSIVE` when it gives none). If absent, injects nothing. Never blocks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `SubagentStop`                                                              | command + prompt                | `check-unit-done.mjs`, inline | **H12** a `UNIT-DONE <unit> <sha> <state>` line is accepted only if the sha is on an `origin` branch (after `git fetch`) and the tree is clean (the hook-written ledger excepted). The prompt then requires PASS to quote the proving output; `impossible: true` when the work cannot finish. Non-fleet subagents pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `TaskCompleted`                                                             | command + agent                 | `check-unit-done.mjs`, inline | **H12** as above on the task subject/description (exit 2 blocks). The agent reads the transcript tail and blocks a completion claim with no supporting tool result (`.claude/rules/fabel-evidence-standard.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Stop`                                                                      | command + prompt                | `check-unit-done.mjs`, inline | **H12** as above on `last_assistant_message` (`{"decision":"block"}`); with `stop_hook_active` it lets the stop through with a `systemMessage` warning. **H14** advisory prompt: lists untagged claim lines and always returns `ok: true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Forcing** (founder-gated, see below): one `Stop` agent hook, timeout 120. Returns `ok: true` at
once when `stop_hook_active` is true. Otherwise runs `node scripts/goals/check-report.mjs --offline`
(if present) and `node scripts/fleet/phase-advance.mjs --dry-run`, classifies the residual per
`goal-circuit-breaker`, and returns `ok: false` with ONE next action only for ACTIONABLE in-bounds
work. Founder-gated (DECISIONS OPEN), PC-gated (PR create/merge), external-lane waits and a residual
already emitted unchanged all return `ok: true`.

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
  or exit code other than 0/2 into what exit 2 does on that event (Claude Code v2.1.295 or
  later). It has no effect on Stop, SubagentStop and TaskCompleted, so those handlers leave it unset;
  SessionStart and UserPromptSubmit leave it unset because they must never block.
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
- _ConfigChange_: matcher on `source`; `{"decision":"block"}` or exit 2 keeps the change out of the
  running session; `policy_settings` cannot be blocked; a block shows no message to anyone.
- _PermissionDenied_: fires only on auto-mode denials, not on PreToolUse hook denials or deny rules;
  only `hookSpecificOutput.retry` is read.
- _PostToolUse decision control_: `additionalContext` adds text next to the tool result;
  `systemMessage` (JSON output) shows a warning to the user.
- _Response schema_: on `Stop`, `ok: false` always continues the turn (`continueOnBlock` does not
  apply there), so the advisory H14 prompt is told to return `ok: true` every time.

## Supersedes `.claude/hooks/pre-bash-validate.py`

That script prints `{"permission":"deny"}`, which is not a documented PreToolUse output field, so
its "blocks" never denied anything. `guard-pretooluse.mjs` replaces it with the documented deny
form. The old file is a protected path and is left untouched; the orchestrator removes its
`PreToolUse` registration in the same protected-change commit that installs `core`, if wanted.

## Limits

- **H12 and H14 are Stop hooks in `core`.** Neither drives toward a goal: H12 blocks a stop only
  when the final message carries a `UNIT-DONE` line whose sha is not on origin or whose tree is
  dirty, and lets the stop through on `stop_hook_active`; H14 always returns `ok: true`. If the
  founder reads the global rule ("a forcing Stop hook requires the founder's explicit Bash
  permission rule") as covering any Stop hook that can block, move them to `forcing` before
  installing. A model that ignores the H14 instruction and returns `ok: false` would force one
  continuation; the `stop_hook_active` cap bounds it.
- **H14 output is not shown anywhere visible.** An `ok: true` reason only reaches the debug log.
  It is advisory by construction; a user-visible version would need a command hook emitting
  `systemMessage`.
- **H11 writes into a tracked file.** `release-receipts/ledger/fleet.jsonl` is tracked on main, so a
  logged denial dirties the working tree. Builders must not stage it (it is a protected path; H3
  denies writing it); H12 ignores it when judging "clean"; the orchestrator ships the rows with
  `scripts/fleet/ledger-push.mjs`.
- **H10 marker.** `config-change.mjs` cannot see the Bash tool's environment, so the installer
  marks what it wrote (sha256 in the temp dir, 5 minutes). Writing the marker by hand does not
  help a builder: the settings file itself is a protected path the guard denies.
- **H13 applies only when `SYNTHEX_FLEET_ROLE=builder` is set explicitly**, so an unmarked
  interactive session keeps its web tools. Every other check uses the effective role (default
  `builder`).
- **H2 runs `claude --version`** (5 s timeout) at session start; "unknown" when it cannot.
- **H2 flags the existing `pre-bash-validate.py` registration** (no `onFailure`), as it should.
- **H9 read-only commands** are an allowlist (`ls`, `cat`, `grep`, `git status/log/diff/show/...`);
  anything else, including `node` and `npm`, is denied under a halt.

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
service. The route prompt runs only on `app/api/**/route.ts` edits; SubagentStop, TaskCompleted
and the H14 Stop prompt run once per event; the forcing Stop agent (up to 120 s) runs once per stop and passes at once
on a continued stop.

## Tests

- `node tools/claude-hooks/selftest.mjs` builds a throwaway fixture repo (with a local bare
  origin) and fires every planted forbidden act and benign act at the hooks. It prints one
  PASS/FAIL line each and exits 0 only when every forbidden act is denied by the check that owns it
  and every benign act is allowed (1 on any FAIL, 2 when the fixture cannot be built). It never
  touches the real repository.
- `npx jest --config config/jest/jest.worktree.cjs tests/unit/claude-hooks` feeds recorded hook
  input to each command hook and asserts the exact output and exit code, checks
  `hooks.settings.json` against the per-event support table, runs the selftest, and runs it again
  on a copy with the H4 check removed to prove it fails.
