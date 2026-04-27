---
name: brand-voice-enforce
description: Mechanical gate that checks senior-skill output against the brand rules locked in `.claude/memory/ceo-foundation.md` and the gate state in `.claude/memory/verification-gates.md`. Reads both at every invocation. Pass/fail decision per draft. Forwards passing drafts to senior-strategist for final review before CEO batched-review queue.
operates_in: [L4-gate]
consumes_from: [foundation-canonical-layer]
foundation_authority: ceo-foundation.md + verification-gates.md
---

# brand-voice-enforce

Mechanical gate. Reads the foundation file at every invocation · derives rules · applies them · passes or fails the draft. Does not embed rule libraries.

## When invoked
Before any client-facing artefact lands in the CEO batched-review queue.

## What it does
1. Read `ceo-foundation.md` sections relevant to the draft's brand + surface
2. Read `verification-gates.md` for any gate state the draft references
3. Check the draft against:
   - Universal taboos (foundation Phase 1 + global CEO standing orders)
   - Brand-specific taboos (foundation Phase 3.X for the brand)
   - Voice tag (foundation Q2.5.5)
   - Phase 4 voice amendments
   - Aid Rule (foundation Q3.1.1) on RestoreAssist drafts
   - Verification-gate tagging (every quantitative claim · `[placeholder]` or `[verified-DD/MM/YYYY]`)
   - Cross-client boundary (foundation Phase 3.4) for CCW drafts
4. Return pass/fail with reasons quoted from foundation

## Pass criteria
ALL universal + brand-specific + Phase 4 + verification rules clear. Single rule failure = REJECT with quoted offending string + foundation citation + recommended fix.

## Hard rules (the only embedded ones)
1. **No caching of foundation rules.** Every invocation re-reads.
2. **No gate flips.** Drafts may reference gate state · never flip it (foundation-keeper owns flips).
3. **CEO override scoped to specific artefact.** `[CEO override · rule X · reason Y]` in metadata permits drift on that draft only.
4. **Output object format:** `{ gate_decision, reasons[], warnings[], verification_state[], recommended_revision }`.

## Versioning
v0.2 (2026-04-27): slimmed from v0.1 · embedded rule libraries removed · delegates to foundation file · token-load reduced ~80%.
