# Evidence Standard — Always-On Rule (Fabel method)

> **Authority**: Always loaded. Applies to ALL outputs and ALL subagent reports
> when building Synthex. Adopted from `CleanExpo/Fabel-Prompt-Engineer` ("The
> Fable System"). Companion to `.claude/FABEL_PLAYBOOK.md` and the
> `fable-engine` skill. Reinforces, does not replace, `verification-gate.md`.

## The rule

Every factual or progress claim carries **exactly one** tag. An untagged claim
is a defect; when in doubt, downgrade.

| Tag             | Meaning                                                                                                     | Rule                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `[VERIFIED]`    | Backed by a checkable source: a tool result you just ran, a URL, or a file path/line in this repo you read. | Only `[VERIFIED]` material may be stated as fact or merged on. |
| `[INFERENCE]`   | A reasonable conclusion from verified material.                                                             | Must name what it was inferred from.                           |
| `[UNCONFIRMED]` | An assumption or unsourced claim.                                                                           | Must be flagged as a risk/assumption, never acted on as fact.  |

## How it binds the build

- **Subagent reports.** A subagent's "build passes / tests green / coverage
  intact" is `[UNCONFIRMED]` to the orchestrator until the orchestrator
  re-runs the gauntlet on the integrated tree. Subagents SHOULD tag their own
  report lines; the orchestrator MUST re-verify before merge.
  _Why: "verified-green" agent reports still concealed a real edge-build break
  (#389) and a too-permissive scorer caught only by review (#395)._
- **Status / done claims.** "Deployed", "live", "passing" require the tool
  output that proves it (the Vercel state, the `Tests:` line). Pair with
  `verification-gate.md`.
- **Specs.** Every `[UNCONFIRMED]` item in a `fable-engine` spec lands in the
  spec's risk/assumption register, not the body.

## Banned without a tag

"should work" · "probably passes" · "looks correct" · "all green" (as an
assertion rather than a quoted tool result) · any external fact (price, API
shape, version) stated without its source.
