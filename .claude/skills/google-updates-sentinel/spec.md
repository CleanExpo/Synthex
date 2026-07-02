# Spec — google-updates-sentinel (SYN-1049 foundation uplift)

## Finish line

Every artefact this connector produces — algorithm-impact diagnoses, recovery plans, and client guidance derived from Sentinel data — is foundation-checked and passes the `brand-voice-enforce` gate before it lands in the CEO batched-review queue.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — AI-search realism, verification gates for impact claims, universal taboos
- `.claude/memory/verification-gates.md` — gate state for any claim referenced
- Sentinel runtime systems (read-only architecture surface this skill documents):
  - `lib/sentinel/sentinel-agent.ts` — `runSentinelCheck` / `runSentinelCheckForAllUsers`
  - `lib/sentinel/algorithm-feed.ts` — `KNOWN_ALGORITHM_UPDATES`, `seedAlgorithmUpdates`, `getRecentUpdates`, `getActiveRollouts`
  - `lib/sentinel/health-checker.ts` — `checkSiteHealth`, `computeHealthScore`, snapshot history
  - `lib/sentinel/alert-engine.ts` — `runAlertEngine`
  - `lib/sentinel/types.ts` — `DEFAULT_THRESHOLDS`, `AlertType`, `AlertSeverity`, `SiteHealthReport`
  - `app/api/cron/sentinel/route.ts` — daily automated check
  - `app/api/sentinel/check/route.ts` — manual on-demand trigger

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Algorithm-impact and recovery claims that cite numbers (traffic %, position deltas, health scores, recovery timelines) carry exactly one evidence tag — `[VERIFIED]` / `[INFERENCE]` / `[UNCONFIRMED]`; projected recovery is never stated as fact.
- [ ] Recovery timelines and correlation-to-rollout claims are framed as directional/hypothesised (AI-search realism), not as guaranteed outcomes.
- [ ] Any client-facing diagnosis or guidance artefact routes through `brand-voice-enforce` before the CEO batched-review queue.

## Referenced paths (only ones VERIFIED to exist on disk)

- `lib/sentinel/sentinel-agent.ts`
- `lib/sentinel/algorithm-feed.ts`
- `lib/sentinel/health-checker.ts`
- `lib/sentinel/alert-engine.ts`
- `lib/sentinel/types.ts`
- `app/api/cron/sentinel/route.ts`
- `app/api/sentinel/check/route.ts`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)

- none

## Verification

- `grep -q "ceo-foundation" .claude/skills/google-updates-sentinel/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred — separate phase on SYN-1049).
- Changes to existing connector behaviour (additive only).
