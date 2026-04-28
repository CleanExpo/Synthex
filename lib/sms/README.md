# `lib/sms/` — SMS Provider Abstraction

Provider-agnostic SMS layer. Twilio is the first concrete provider; future providers (Vonage · MessageBird · AWS SNS) implement the same `SmsProvider` interface.

**Linear:** SYN-833 (parent: SYN-822 AEO epic)
**Owners:** `marketing-operations-director` + `code-architect`
**Foundation authority:** `ceo-foundation.md` (Q3.2.4 H8 + Q3.2.5 P10/P16) + `verification-gates.md` (VG-AEO-3)

---

## Files

| File                 | Purpose                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `types.ts`           | `SmsMessage` · `SmsResult` · `SmsProviderConfig` · `SmsProvider` interface                      |
| `twilio-provider.ts` | Twilio REST API implementation (no SDK dep — direct fetch)                                      |
| `index.ts`           | Provider factory + env-config reader + lazy singleton                                           |
| `__tests__/`         | Jest unit tests covering interface contract + Twilio adapter happy path + PII-redaction in logs |

## Hard rules (binding on every send)

1. **Source-of-truth job ID required** — every `send()` call MUST carry `sourceOfTruthJobId` per Q3.2.4 H8. Provider throws if omitted.
2. **No raw phone in logs** — recipient is hashed (sha256 first 12 chars) before any log call. P10 binding.
3. **No body in logs** — message body is never logged in plain text. Only metadata (jobId · brand · twilio status code).
4. **Brand carried in metadata** — for cross-brand frequency-cap pooling (`marketing-operations-director` hard rule 3) and Phase 3.4 boundary enforcement.
5. **No content-vetting in provider** — that's `brand-voice-enforce` upstream. Provider is dumb pipe + audit logger.

## Usage

```ts
import { getSmsProvider } from '@/lib/sms';

const sms = getSmsProvider();
const result = await sms.send({
  to: '+61400000000',
  body: 'Hey Sam. Thanks for choosing us. Mind sharing what we fixed and how it went? — DR',
  sourceOfTruthJobId: 'dr_job_2026_04_29_0042',
  brand: 'DR',
});

if (result.ok) {
  // record `result.providerMessageId` against the job for status-poll later
}
```

## Env config

| Var                  | Required when SMS_PROVIDER= | Notes                                |
| -------------------- | --------------------------- | ------------------------------------ |
| `SMS_PROVIDER`       | always (default: `noop`)    | `twilio` · `noop`                    |
| `TWILIO_ACCOUNT_SID` | `twilio`                    | Starts with `AC` (Twilio convention) |
| `TWILIO_AUTH_TOKEN`  | `twilio`                    | ≥ 32 chars                           |
| `TWILIO_FROM_NUMBER` | `twilio`                    | E.164 format, e.g. `+61400000000`    |

Local dev / CI: leave `SMS_PROVIDER` unset → no-op provider returns fake success without hitting Twilio.

## Adding a new provider

1. Create `lib/sms/<provider>-provider.ts` implementing `SmsProvider`
2. Add discriminated union arm to `SmsProviderConfig.provider` in `types.ts`
3. Add `case '<provider>':` to the factory in `index.ts`
4. Add unit tests under `__tests__/` mirroring the Twilio coverage
5. Add env vars to `.env.example` with comment block
6. Update this README's env-config table
7. Open SYN-AEO-XX child ticket for the new provider
