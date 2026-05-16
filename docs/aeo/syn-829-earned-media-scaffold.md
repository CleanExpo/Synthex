# SYN-829 — Earned-media unstructured-mention programme

**Mandate:** 27e98e38-a6fd-4269-b223-db00f5e0e629
**Parent:** SYN-822
**Status:** Scaffold — pitches not authored, awaiting mention baseline

## Gate dependency

- **brand-voice-enforce** (PR #243) at `surface='outreach'` — every pitch draft passes the gate before sending
- **VG-AEO-2** mention freshness — R7 binds via `mention_freshness` (PR #244)
- **SYN-AEO-3** mention baseline complete (A5 deliverable)

Per epic SYN-829 pre-condition: *"`brand-voice-enforce` gate passes per draft."*

## What this PR does NOT ship

Pitch templates. Authoring is `pr-communications-lead` + `brand-strategist`. Engineering wires up the outreach surface; copywriters land the templates in a follow-up.

## Engineering surface (ready)

- `enforceBrandVoice({ brand, candidate: pitchBody, surface: 'outreach', mentionRef? })` — already shipped in PR #243
- R7 freshness check — already shipped, skip-with-evidence until `mention_freshness` populates

## Per-brand publisher list

- DR: insurance trade press + IICRC AU + Brisbane business journals
- NRPG: trade press
- RestoreAssist: trade press + IICRC
- CARSI: insurance trade press
- CCW: carpet / textile trade press (Phase 3.4 boundary)

## Reference-customer slot

- Slot 3 (insurance carrier) — every outreach has a freshness check + gate-run audit trail. Carriers consume this as a vendor-discipline proof.
- Slot 2 (multi-location franchise) — earned media is the org-trust signal franchises buy this for

## Blocker

- A5 (non-directory mention baseline) ingestion. Until `mention_freshness` populates, R7 skips.
- Copywriter authoring of per-brand pitch templates.
