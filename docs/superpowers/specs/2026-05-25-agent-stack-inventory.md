# Agent stack inventory — 2026-05-25

**Linear:** SYN-988  
**Plan:** `docs/superpowers/plans/2026-05-25-agent-stack-cursor-upgrade.md`

## Composer 2.5 (Cursor)

| Item                   | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| Released               | 2026-05-18                                                         |
| Changelog              | https://cursor.com/changelog/composer-2-5                          |
| Model IDs              | `composer-2.5` (Standard), `composer-2.5-fast` (Fast, IDE default) |
| Pricing (per M tokens) | Standard: $0.50 in / $2.50 out · Fast: $3.00 in / $15.00 out       |

### Synthex adoption

| Surface                    | Recommended model   | Action                                     |
| -------------------------- | ------------------- | ------------------------------------------ |
| Cursor Agent (interactive) | `composer-2.5-fast` | Human: update Cursor app + model picker    |
| Background / ship-loop     | `composer-2.5`      | Document in ship-loop skills when SDK used |
| `@cursor/sdk` scripts      | `composer-2.5`      | Add only when SDK adopted (Phase 3)        |

### Repo grep (hardcoded slugs)

No `composer-2` or `composer-2.5` strings in application code as of this audit. AI routes use provider-specific IDs (`claude-haiku`, `gemini-2.5-flash`, OpenRouter slugs) — unchanged by Composer 2.5.

## OpenAI Codex CLI

| Item                     | Value                                 |
| ------------------------ | ------------------------------------- |
| Latest stable referenced | **0.133.0** (2026-05-21)              |
| Repo                     | https://github.com/openai/codex       |
| Install                  | `npm install -g @openai/codex@latest` |

### Notable 0.133.0 features

- Goals enabled by default (multi-turn progress storage)
- Permission profiles + `requirements.toml` + Windows sandbox improvements
- Plugin marketplace discovery
- `codex remote-control` foreground workflow

### Synthex policy

| Tool                 | Usage                                  |
| -------------------- | -------------------------------------- |
| `codex-adversarial`  | Manual only — auth/payments/migrations |
| `codex-local`        | Optional cheap second opinion          |
| Autonomous ship-loop | **No** Codex wired in                  |

## gstack (garrytan/gstack)

| Item             | Value                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Repo             | https://github.com/garrytan/gstack                               |
| Install location | User-global `~/.claude/skills/gstack` (not vendored in repo)     |
| Synthex enabled  | `/qa`, `/cso` only                                               |
| Disabled         | 21 other commands (duplicate Synthex skills) — MEMORY 28/04/2026 |

### Upgrade procedure (human)

```powershell
cd $env:USERPROFILE\.claude\skills\gstack
git pull --ff-only origin main
# Do NOT run ./setup --team inside d:\Synthex
```

Re-evaluate new skills against `.claude/skills/` catalog before enabling any additional command.

## Karpathy influences

| Repo                                                                                          | Steal                                        | Skip                               |
| --------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------- |
| [karpathy/autoresearch](https://github.com/karpathy/autoresearch)                             | `program.md` loop, fixed metric, keep/revert | ML training code                   |
| [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) | Four principles in `CLAUDE.md`               | —                                  |
| llm-council                                                                                   | —                                            | SYN-807 `boardroom` already covers |

## Indy Dev Dan (disler)

| Repo                                                                                                                 | Steal                                          |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)                                     | stdin drain + JSON stdout contract             |
| [claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) | Optional JSONL hook log (`SYNTHEX_HOOK_LOG=1`) |
| [the-library](https://github.com/disler/the-library)                                                                 | Skill pointer catalog pattern (reference)      |

## Phase 0 human checklist (not in git)

- [ ] Cursor app updated (May 2026+)
- [ ] Composer 2.5 Fast selected in Agent
- [ ] Settings → Hooks: remove stale `$CLAUDE_PROJECT_DIR` / `pre-bash-validate.py` entries
- [ ] Reload Cursor window
- [ ] `powershell -File scripts/test-cursor-prebash-hook.ps1`
- [ ] Fix corporate TLS if `node` cannot reach `api.vercel.com` (optional)
