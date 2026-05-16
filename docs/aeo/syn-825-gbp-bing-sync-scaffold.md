# SYN-825 — DR GBP attribute completion + Bing Places sync

**Mandate:** 27e98e38-a6fd-4269-b223-db00f5e0e629
**Parent:** SYN-822
**Status:** SCAFFOLD — handlers stubbed pending GBP OAuth

## Gate dependency

- **VG-AEO-4** (Bing Places parity) — `[CEO override-2026-05-10]`. Flips to verified once NAP corrections submitted across all 5 directories + Bing Places sync activated.
- Independent of `brand-voice-enforce` (this is structured-data sync, no copy).

## Scope (matrix B1 + B3)

- B1: All DR GBP attributes filled where applicable; weekly health-check cadence
- B3: NAP corrections submitted to all 5 directories; Bing Places sync verified

## Pre-condition

- SYN-823 (DR audit baseline) — DONE 2026-04-28
- GBP API OAuth — Phill-side action; engineering cannot self-provision

## Reference-customer slot

- Slot 1 (high-volume B2C restorer) — same GBP playbook re-applies to slot customers verbatim
- Slot 3 (insurance carrier) — Bing Places parity = trust signal for carrier reporting (ChatGPT uses Bing's index)

## Engineering work in this PR

- Doc only. Implementation lands once OAuth flow is wired (separate ticket).
- Will use `service_area_coverage` (already-merged SYN-834 model) as the source-of-truth list of suburbs whose GBP entries need updating.

## Blocker

GBP API OAuth credential. Phill-side per Linear epic CEO-decisions.
