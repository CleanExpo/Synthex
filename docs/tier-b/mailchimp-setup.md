# B3 — Mailchimp Setup Window (P0 blocker)

> **Status:** Scoping only (SYN-812). Implementation gated on credential
> handoff (SYN-811) and per-brand domain provisioning by Phill.

## Scope

ESP wiring across the four nested Unite-Group brands so B2 trigger
orchestration has a delivery layer. Per-brand sender accounts; portfolio
audience layer at the top so frequency cap pooling can read a single
authoritative state.

## Foundation references

- Q2.5.3 — pooled frequency cap (Mailchimp's audience-level rate limits
  must allow this; the pool happens at B2 application layer, but ESP
  config must not contradict it)
- 8pm-7am AU quiet hours — Mailchimp's send-time optimisation must NOT
  override; quiet hours come from B2, ESP just sends what it's told
- VG-71 — external client agreement gates the audience structure (external client is excluded)

## Brand sender accounts

| Brand                  | Sender domain                                                                | Reply-to       | Status                |
| ---------------------- | ---------------------------------------------------------------------------- | -------------- | --------------------- |
| DR (Disaster Recovery) | TBD by Phill                                                                 | TBD by Phill   | not provisioned       |
| NRPG                   | TBD by Phill                                                                 | TBD by Phill   | not provisioned       |
| CARSI                  | spprtcarsi@... (per [SYN-834](https://linear.app/unite-group/issue/SYN-834)) | spprtcarsi@... | partially provisioned |
| RestoreAssist          | TBD by Phill                                                                 | TBD by Phill   | not provisioned       |

Each brand needs:

1. Dedicated sender account in Mailchimp
2. DKIM record configured + verified
3. SPF record configured + verified
4. DMARC record at `p=quarantine` minimum (target `p=reject` after 30 days clean)
5. AU/NZ deliverability check (Spamhaus, Barracuda, Microsoft SmartScreen)

## Portfolio audience layer

Single Mailchimp account hosts all four brands. Audience structure:

```
Account: Unite-Group Portfolio
├── Audience: DR
├── Audience: NRPG
├── Audience: CARSI
└── Audience: RestoreAssist
```

Identity from B1 (`identity_records`) writes into the relevant audience
based on `brand_codes`. An identity with multiple brand_codes lives in
multiple Mailchimp audiences (Mailchimp doesn't natively pool — pooling
happens at B2's frequency cap layer reading `mailchimp_events`).

## Customer Journey templates

One Customer Journey per active trigger that has an email touchpoint:

- T3 — 7-day no-action follow-up
- T4 — cross-promotion (cross-brand only fires post-B1)
- T5 — compliance deadline approaching (T5 overrides T3/T4/T7/T10)
- T7 — quarterly check-in
- T8 — hard compliance deadline reached
- T10 — annual renewal

T1 (new lead) and T2 (reply received) don't have email Customer Journey
templates — they're event-driven.

Each template sends through the brand's sender account (per audience).
Cross-brand templates (T4) need a per-receiving-brand variant — DR does
not send mail under NRPG branding.

## Identity resolution wiring to L1

Mailchimp webhook → Edge Function → `identity_records` upsert. Webhook
events captured:

- `subscribe` — add audience to `brand_codes` if new
- `unsubscribe` — set `consent_state.<brand>.marketing = false`
- `cleaned` — set `consent_state.<brand>.deleted_at` (bounce / hard fail)
- `campaign.send.result` — append to `mailchimp_events` for frequency cap

## Smoke test plan

1. **DKIM/SPF/DMARC verification** — `dig TXT _dmarc.<sender-domain>` returns
   the configured policy; mail-tester.com score ≥ 9/10.
2. **AU/NZ delivery test** — send one campaign per brand to a known AU + NZ
   inbox; receive in inbox (not spam) within 60 seconds.
3. **Webhook → identity_records** — manually unsubscribe from one audience
   in Mailchimp UI; within 30 seconds, `consent_state.<brand>.marketing`
   flips to false in `identity_records`.
4. **Frequency cap visibility** — fire 3 sends to one identity in a week;
   `mailchimp_events` shows 3 rows; B2's check returns
   `frequency_cap_pool_exceeded` for the 4th attempt.
5. **Cross-brand suppression** — identity has `brand_codes: ['DR', 'NRPG']`;
   T4 cross-promo from DR to NRPG only fires if NRPG audience hasn't
   already touched the identity in the last 7 days.

## CEO action items (must clear before engineering starts)

- [ ] **Per-brand sender domains** chosen, DNS pre-provisioned (root
      domain owners must add DKIM/SPF/DMARC records)
- [ ] Mailchimp account at the right tier (Standard or higher for
      Customer Journeys + transactional)
- [ ] Brand voice / copy approved per template (T3, T4, T5, T7, T8, T10)
- [ ] external client agreement (VG-71) — confirms external client is NOT in the audience layer
- [ ] Compliance content approved for T5 + T8 (these are legal-deadline
      touches — copy must be reviewed by legal, not just brand)

## Out of scope

- Transactional email (receipts, password resets) — uses existing email
  service (Resend), not Mailchimp
- SMS triggers — separate provider (B3 is email-only per Q2.5.3)
- external client marketing — explicitly excluded
- Custom HTML email design — use Mailchimp templates initially; design
  upgrade is a separate ticket
