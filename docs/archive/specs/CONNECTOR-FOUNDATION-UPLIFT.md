# Connector Foundation Uplift — Program Spec (SYN-1049)

> Internal Unite-Group Nexus program. Brings every un-wired **action-connector**
> skill up to the same standard the senior skills already meet, so that
> everything generated through Synthex (designs, campaigns, copy, visuals,
> layouts) is checked against the locked foundation and passes the brand-voice
> gate before it lands.

## Finish line

Every connector in scope, when invoked, (1) re-reads the foundation spine, (2)
routes client-facing output through the `brand-voice-enforce` gate, (3) carries
evidence tags on every claim, and (4) has a committed `spec.md`. The repo gate
(type-check + lint + test) stays 100% green.

## Why these and not the others

The 9 "senior" connectors already declare _"Reads ceo-foundation.md +
verification-gates.md at every invocation"_ and gate through brand-voice-enforce.
The 12 action-connectors below do not — that gap is the entire program. The 9
wired ones are **out of scope** (no unrequested changes).

## Scope (12)

`brand-campaign-generator` · `brand-consistency-checker` · `business-dna` ·
`campaign-planner` · `local-seo-agent` · `client-content-studio` ·
`client-manager` · `code-review` · `competitive-local-strategy` ·
`google-business-profile` · `google-search-console` · `google-updates-sentinel`

## Per-connector contract (Definition of Done)

1. SKILL.md carries the standard **Foundation & Gate Wiring** section (below),
   with connector-specific foundation-section citations.
2. Output routes through `brand-voice-enforce` before the CEO batched-review queue.
3. Evidence-standard tags required (`[VERIFIED]`/`[INFERENCE]`/`[UNCONFIRMED]`).
4. Companion `spec.md` in the skill directory (finish line + acceptance + verification).
5. Every referenced `lib/` path verified to exist — no hallucinated references.
6. **Additive only** — existing body content preserved verbatim.
7. Repo gate green; auto-merge only when all required checks are 100% green.

## Standard Foundation & Gate Wiring block (verbatim, citations filled per connector)

```markdown
---

## Foundation & Gate Wiring (SYN-1049)

> Adopted from the senior-skill standard so every artefact this connector
> produces is checked against the locked foundation before it lands.

**Reads at every invocation (never cached — re-read each run):**

- `.claude/memory/ceo-foundation.md` — <connector-specific sections>
- `.claude/memory/verification-gates.md` — gate state for any claim referenced.

**Output gate:** every client-facing artefact routes through `brand-voice-enforce`
before the CEO batched-review queue. A REJECT blocks the artefact until the
quoted offending string is fixed.

**Evidence standard:** every quantitative or factual claim carries exactly one
tag — `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`. Untagged = defect
(`.claude/rules/fabel-evidence-standard.md`).

**Spec:** see `spec.md` in this skill directory.
```

## Verification

- `grep -L "ceo-foundation" .claude/skills/<each>/SKILL.md` returns nothing in scope.
- `spec.md` exists for each in-scope connector.
- `npm run type-check && npm run lint && npm test` green (markdown-only changes
  do not affect TS, so the gate stays green; we still run it to prove it).

## Operating contract

- Founder-authorised auto-merge for this program (CONSTITUTION human-gate
  override, **scoped to this program only**). Does not extend to schema-destructive
  changes, secrets, or anything outside the program.
- Hard floor retained: auto-merge **only** when all required checks are green.
- Browser/visual verification deferred (no test creds/URL in current env) —
  tracked as a separate phase on SYN-1049.

## Tracking

Linear epic **SYN-1049**. Each connector is a checklist item; `spec.md` per
connector is the per-task artefact.
