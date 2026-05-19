# Consent And Story Evidence Policy

## Decision

Real stories are allowed only when source, consent status, and evidence are recorded. Fake stories, invented testimonials, unverified before/after claims, and assumed consent are blocked.

## Story Evidence Requirements

Every `CustomerStory` must have:

- organisation owner
- client brand
- story source
- source date
- source type
- consent status
- consent scope
- evidence record
- claim list
- reviewer status

## Consent Status

| Status | Meaning | Export Use |
| --- | --- | --- |
| unknown | No consent evidence. | Blocked. |
| requested | Consent requested but not granted. | Blocked. |
| granted_limited | Consent granted with restrictions. | Allowed only within scope. |
| granted_full | Consent granted for campaign use. | Allowed subject to restrictions. |
| revoked | Consent withdrawn. | Blocked and removed from future exports. |
| expired | Consent no longer valid. | Blocked. |

## Evidence Types

- signed release
- email approval
- recorded interview transcript
- CRM note with source metadata
- public review URL
- uploaded document
- customer-supplied image/video
- internal case note

## Claim Handling

Claims from stories must be classified:

- factual
- outcome
- comparative
- subjective
- testimonial
- future-looking

Factual, outcome, and comparative claims require evidence before export.

## Blocked Content

- fabricated testimonials
- generated fake customer names
- invented case studies
- before/after claims without evidence
- health, financial, legal, or safety claims without elevated review
- real person likeness without consent
- customer images without image usage permission

## Evidence Pack Contents

- story ID
- source type
- source location
- consent record
- allowed usage
- claims extracted
- substantiation references
- reviewer decision
- blocked or redacted content

## Acceptance Criteria

- Every story has consent status.
- Every story-derived claim links to evidence or is blocked.
- Revoked/expired consent removes story from client-ready export.
- Generated creative never invents a customer, source, quote, or outcome.
