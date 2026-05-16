# SYN-827 — Per-brand review-language SMS template scaffold

**Mandate:** 27e98e38-a6fd-4269-b223-db00f5e0e629 (Synthex Phase 4 · VG-AEO)
**Parent:** SYN-822
**Status:** SCAFFOLD ONLY — drafts not authored in this PR

## Gate dependency

- **VG-AEO-3** (per-brand review-language SMS template approval) — `[CEO override-2026-05-10]`
- **brand-voice-enforce** (PR #243) — required, MECHANICAL gate
- Twilio provider (`lib/sms/`) — already merged (SYN-833)

Per the 2026-05-10 CEO override Section 10: **"Override does NOT bypass `brand-voice-enforce` mechanical gates on B4 SMS templates."**

Per the epic (SYN-822) pre-condition: **"VG-AEO-3 flipped via CEO sign-off on per-brand draft"** — drafts must reach `brand-voice-enforce` PASS, then CEO batch-queue approves, which flips VG-AEO-3 from `[CEO override]` to `[verified-DD/MM/YYYY]`.

## What this PR does NOT ship

- No SMS template strings. Drafts come from `senior-copywriter` + `pr-communications-lead` per the SYN-827 owner field.
- No CEO sign-off bypass. Templates land in a separate follow-up PR after drafts pass the gate.

## What this PR ships

- This scaffold doc, locking the per-brand template author surface:
  - DR primary — post-job SMS via Twilio
  - NRPG — conditional (B2B sub-brand, typically no consumer-SMS surface)
  - RestoreAssist — in-app prompt (not Twilio, but uses the same gate via `surface='sms'`)
  - CARSI — B2B; no consumer SMS template expected
  - CCW — Phase 3.4 boundary; TBD

## Test contract (when templates land)

Every template proposed in the follow-up PR MUST:

1. Pass `enforceBrandVoice({ brand, candidate: template, surface: 'sms', sourceOfTruthJobId: 'placeholder' })`
2. Be under 320 chars (R8 — 2 GSM segments)
3. Pass R1..R5 for the named brand
4. Be added as a JSON fixture under `__tests__/aeo/fixtures/sms-templates/` so future template edits cannot regress

## Reference-customer slot

- **Slot 1 (high-volume B2C restorer)** — this is the primary buyer of SMS templates with mechanical enforcement
- **Slot 2 (multi-location franchise)** — needs the per-brand template variants this scaffold preserves

## Blocker

CEO sign-off on per-brand draft text. Engineering-side, the gate is ready (PR #243). Authoring is owned by `senior-copywriter` per Linear.
