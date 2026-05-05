# Email Sequence — {brand} {sequenceName}

> Template consumed by `marketing-copywriter` for any email sequence (launch / nurture / lifecycle).

## Sequence header
- Brand: {slug}
- Sequence type: {launch | nurture | lifecycle | reactivation}
- Trigger: {sign-up | trigger event | manual send}
- Audience segment: {from ICP segmentation}
- Send window: {days/weeks across}
- Branching: {linear | engaged-vs-cold | event-driven}

## Per-email block

### Email 1 — {purpose, e.g. "welcome + one core promise"}
- Send delay: {0 | T+1d | T+3d}
- Subject A: {≤45 chars}
- Subject B (variant): {≤45 chars}
- Preview text: {≤90 chars}
- Body:
```
{plain-text body, ≤200 words, one CTA}
```
- CTA: {primary action} → URL with UTM `?utm_source={brand}-email&utm_medium=email&utm_campaign={jobId}&utm_content=email-1`

### Email 2 — {purpose}
…

## Voice lint pass
- [ ] Zero first-person plurals (we / our)
- [ ] Zero AI-filler words
- [ ] Cadence matches `BrandConfig.voice.requiredCadence`
- [ ] No spam-trigger words (free, guaranteed, !!!, ALL CAPS subject)

## Attribution wiring
- All links UTM-tagged via `marketing-studio/scripts/utm-builder.ts`
- ESP webhook → PostHog `email_opened` / `email_clicked` events
- Conversion event: {event name in tracker}
