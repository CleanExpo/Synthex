# SYN-830 — Post-job SMS automation rollout for DR + RA

**Mandate:** 27e98e38-a6fd-4269-b223-db00f5e0e629
**Parent:** SYN-822
**Status:** Scaffold — depends on SYN-827 (templates) + SYN-833 (Twilio, DONE)

## Gate dependency

- **brand-voice-enforce** (PR #243) at `surface='sms'` with `sourceOfTruthJobId` REQUIRED (R9)
- **SYN-827 templates** — drafts must be approved + flip VG-AEO-3 to verified
- **SYN-833 Twilio provider** — DONE (already merged)

## Per epic SYN-830 pre-condition

> - SYN-AEO-6 (templates approved + VG-AEO-3 flipped)
> - SYN-AEO-12 (Twilio provider scaffold) merged
> - DR/RA job-ID propagation verified per Q3.2.4 H8

## Wiring (when unblocked)

The integration flow is:

```ts
// 1. job-id arrives from DR/RA backend
const enforce = await enforceBrandVoice({
  brand: 'dr',
  candidate: renderTemplate(approvedTemplate, jobContext),
  surface: 'sms',
  sourceOfTruthJobId: jobContext.jobId,
});
if (!enforce.pass) throw new BrandVoiceEnforceError(enforce.reasons);

// 2. Hand to Twilio
await getSmsProvider().send({
  to: jobContext.customerPhone,
  body: enforce.candidate, // body has not been mutated by the gate
  sourceOfTruthJobId: jobContext.jobId,
  brand: 'DR',
});
```

The gate is sync-fast (<5ms in test runs) — no perf concern for per-job invocation.

## Reference-customer slot

- **Slot 1 (high-volume B2C restorer)** — this IS the slot-1 product. Post-job SMS + mechanical enforcement = the AEO Tier-1 score lever
- Slot 2 / 3 indirect

## Blocker

- SYN-827 template approval (drafts + CEO sign-off)
- Job-ID propagation verified end-to-end DR + RA (Q3.2.4 H8)
