# Spec — content-pipeline (SYN-1050 foundation uplift)

## Finish line

Every artefact this skill produces — generated content, scoring output, repurposed variants — is foundation-checked and brand-voice-gated before it lands.

## Inputs read at invocation

- `.claude/memory/ceo-foundation.md` — voice tag (Q2.5.5), universal + brand-specific taboos, verification gates for any quantitative claim
- `.claude/memory/verification-gates.md`
- `lib/ai/model-registry.ts` — single source of truth for model selection
- `lib/ai/providers/index.ts` — `getAIProvider()` factory for provider abstraction
- `lib/ai/api-credential-injector.ts` — BYOK key lookup/decryption

## Acceptance criteria

- [ ] SKILL.md carries the Foundation & Gate Wiring section.
- [ ] Content generation selects models via `lib/ai/model-registry.ts` — no hardcoded model IDs.
- [ ] All provider calls route through `getAIProvider()`, never `lib/ai/openrouter-client.ts` directly (legacy only).
- [ ] Every generated artefact is run through `lib/ai/content-scorer.ts` before publish.
- [ ] Client-facing artefacts pass the `brand-voice-enforce` gate before the CEO batched-review queue.

## Referenced paths (only ones VERIFIED to exist on disk)

- `lib/ai/model-registry.ts`
- `lib/ai/model-manager.ts`
- `lib/ai/providers/index.ts`
- `lib/ai/providers/base-provider.ts`
- `lib/ai/providers/openrouter-provider.ts`
- `lib/ai/providers/anthropic-provider.ts`
- `lib/ai/providers/google-provider.ts`
- `lib/ai/api-credential-injector.ts`
- `lib/ai/content-generator.ts`
- `lib/ai/content-scorer.ts`
- `lib/ai/content-repurposer.ts`
- `lib/ai/openrouter-client.ts`
- `lib/encryption/api-key-encryption.ts`
- `app/api/system/models`
- `.claude/memory/ceo-foundation.md`
- `.claude/memory/verification-gates.md`
- `.claude/rules/fabel-evidence-standard.md`

## Known drift (referenced but missing on disk)

- none

## Verification

- `grep -q "ceo-foundation" .claude/skills/content-pipeline/SKILL.md`
- Repo gate: `npm run type-check && npm run lint && npm test` green (markdown-only change).

## Out of scope

- Live browser/visual verification (deferred).
- Changes to existing skill behaviour (additive only).
