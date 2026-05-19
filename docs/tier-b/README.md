# Tier B — Engineering Layer Specs (SYN-812)

Tier B turns the Tier A documentation into running code. Five engineering
workstreams. Each has its own spec in this directory.

These specs are **scoping only** per the SYN-812 narrowed scope — the actual
6–10 week B1-B5 build is a separate epic, gated on commercial + credential
prerequisites listed in each spec.

## Workstreams

| ID  | Spec                                                   | One-line scope                                                             |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| B1  | [identity-resolution-l1.md](identity-resolution-l1.md) | Unified customer record across DR + NRPG + RA + CARSI (external client excluded)       |
| B2  | [trigger-orchestration.md](trigger-orchestration.md)   | Event detection for the 8 active triggers + frequency cap pooling          |
| B3  | [mailchimp-setup.md](mailchimp-setup.md)               | Per-brand sender accounts + audience layer + Customer Journey templates    |
| B4  | [snapshot-tool.md](snapshot-tool.md)                   | Static PDF → interactive Snapshot tool → Mailchimp + checkout integration  |
| B5  | [dashboard-wiring.md](dashboard-wiring.md)             | Reporting templates → live data feeds + Hyper-Care daily snapshot pipeline |

## Sequencing

```
B3 (Mailchimp ESP)        ──┐
                            ├─→ B2 (Trigger orchestration)
B1 (Identity resolution)  ──┘                                ──→ B5 (Dashboard wiring)
B4 (Snapshot tool) ────────────────────────────────────────────↗
```

- **B3 gates B2** — no email triggers can fire without an ESP wired.
- **B1 gates B2 frequency cap** — pooling needs cross-brand identity.
- **B4 gates CARSI Cat 1 vs Cat 3** — Remotion video full conversion arc depends on Snapshot.
- **B5 gates `performance-attribution-lead`** — skill outputs flowing automatically depend on dashboard wiring.
- **All gate on credential handoff** — see [SYN-811](https://linear.app/unite-group/issue/SYN-811) Integration Architecture document.
- **All gate on commercial agreements** — external client agreement (VG-71) is a hard prerequisite.

## Foundation references

Every spec in this directory MUST honour, by reference:

- `ceo-foundation.md` Phase 4 + Q3.3.4 + Q3.4.4 — workstream definitions
- Q2.5.4 — 9-layer infrastructure split
- Q2.5.3 — pooled frequency cap rule (3 touches / 7 days per identity)
- Q2.5.2 — 8 active triggers (T1, T2, T3, T4, T5, T7, T8, T10)
- Q3.2.4 — source-of-truth job ID linking D4 ↔ N4 (no double-counting)
- Q3.2.5 — P16 Right-to-Be-Forgotten with de-identified retention
- P6 — never reuse owner-deletable data for marketing without explicit per-firm consent
- Verification gates: VG-04, VG-05, VG-40, VG-41, VG-42, VG-71, VG-72

## Per-spec acceptance criteria (SYN-812)

Each workstream spec in this directory:

1. References the foundation rules + verification gates it must honour
2. Includes a smoke-test plan (small, verifiable signals — not the full eng plan)
3. Lists the CEO action items that must clear before engineering work commences

## Out of scope here

- B1-B5 implementation code (separate epic, 6-10 weeks, gated on prerequisites)
- external client (Cleaning Care Warehouse) — strictly excluded from B1 per Phase 3.4 carve-out
- Tier A artefacts — assumed shipped before any Tier B work begins
