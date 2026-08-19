# Real Images Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. The spec (`docs/superpowers/specs/2026-07-12-real-images-only-design.md`) is the requirements document — every task below implements its lettered Parts. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Invert the system default — every image/video generation grounds on the owned reference library + auto-applies the industry LoRA; no owned references ⇒ BLOCK; ungrounded output only via the audited `useReferences:false` escape hatch, loudly stamped.

**Architecture:** Single shared gate in the image service (choke point), fail-closed grounding, LoRA auto-resolution by industry, schema additions on the structurally-ungroundable routes, a static enforcement guard test, dashboard default-ON UX. Branch `feat/real-images-only` off origin/main.

**Tech Stack:** unchanged (no new deps).

## Global Constraints

- Spec is authoritative: `docs/superpowers/specs/2026-07-12-real-images-only-design.md` (founder mandate; BLOCK on no coverage).
- Sweep pathway inventory (28 items) = coverage checklist: workflow journal `wf_f2bcda00-9a7` lanes service-core / routes-mcp / content-pipelines.
- Australian English in user-facing copy. Zod on mutation routes. Error shape `{ error, details? }`. No new npm packages.
- Blocked = HTTP **422** `{ error, blocked: true }` at routes; service result `{ success:false, blocked:true, grounded:false }`.
- Escape hatch stamps: `grounded:false` + `warnings: ['UNGROUNDED — generated without owned references (explicit override)']`.
- Existing tests asserting default-ungrounded behaviour are REWRITTEN to the new contract (deliberate break, founder-mandated).
- Gate: `npm run type-check && npm run lint && npm test` — real tallies.

### Task 1 (W1 — core): Part A entire, in `lib/services/ai/image-generation.ts` + `lib/services/ai/image/trained-loras.ts`

`shouldGround()` shared gate default-on; block-on-no-coverage; block-on-grounding-failure after 1 retry; escape-hatch stamping; deprecated-provider enforcement + pinned-provider-requires-escape-hatch; `resolveLoraForIndustry` + auto-apply (explicit loraId wins); LoRA-failure → grounded-FLUX fallback → fail-closed; variations/batch inheritance contract test. Tests: `tests/unit/ai/real-images-gate.test.ts` (new) covering every Part A number; update `tests/unit/ai/image-generation-grounding.test.ts` + `tests/unit/ai/trained-loras.test.ts` premises.

### Task 2 (W2a — routes/MCP): Part B image surfaces

Route loraId passthrough + batch lineage loraId/loraApplied stamps + 422 mapping (single + batch, `status:'blocked'` lineage rows); VariationsSchema + threading; MCP tool description rewrites; demo route reroute via escape hatch + sanctioned-exception comment. Tests: route-shape units updated; batch 422 case.

### Task 3 (W2b — video): Part B video surfaces

`generation-service.ts` gate inversion + private-refs fallback + seed fail-closed; `/api/video/generate` schema fields; legacy media/generate/video schema fields + guard test; MCP generate_video description. Tests: `tests/unit/ai/video-grounding*.test.ts` premises updated + block case.

### Task 4 (W3a — UI): Part D

Toggle default ON + inverted copy + confirm-on-disable; 422 blocked-state rendering with /reference-library link; grounded badge / UNGROUNDED stamp on results (single + batch card); insights groundedShare (aggregator + panel line).

### Task 5 (W3b — estate cleanup): Part C exceptions

Brand-video worker beat images → generateImage; campaign scripts archived to `.claude/archived/2026-07-12/ungrounded-scripts/`; canary sanctioned-exception comment; automation rules-engine contract test.

### Task 6 (W3c — guard): Part C static test

`tests/unit/ai/no-direct-image-apis.test.ts` with the exception register; must fail on a planted violation (self-test), pass on the tree.

### Task 7 (W4): Full gate + suite sweep + final whole-branch review (strongest model) + fix wave.

### Task 8 (W5): Ship

PR → 100%-green watcher → merge → deploy Ready → live verification (spec Verification section) → founder demo of the block + grounded default.
