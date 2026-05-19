# Meta Creative QA Checklist

## Decision

Meta QA is required before export. It validates format readiness and policy-sensitive creative risks, but it does not publish or spend.

## Required Checks

### Format

- 9:16 vertical export available for Reels/Stories.
- 4:5 feed export available.
- 1:1 feed export available.
- 16:9 export available only when requested.
- Captions readable on mobile.
- Brand appears early.
- CTA is explicit.
- Thumbnail is legible.
- Audio recommendation has licence status.

### Evidence

- Factual claims are evidence-linked.
- Testimonials have consent.
- Images/video of real customers have consent.
- Asset licences pass.
- Unsupported claims are removed or blocked.

### Creative

- Hook is clear within the opening seconds.
- Product value is concrete.
- Persona pain or aspiration is visible.
- Story has a beginning, turn, and action.
- Captions support sound-off viewing.
- No misleading before/after implication.
- No exaggerated outcome promise.

### Accessibility

- Captions included.
- Text contrast is readable.
- Text does not overlap essential visuals.
- No flashing or rapid motion risk without review.
- Mobile preview is usable.

### Publishing Guard

Block any publish or spend path unless:

- `APPROVED_TO_PUBLISH_META_ADS=true`
- campaign approval state is approved
- Meta credentials exist
- compliance pass exists
- licence pass exists
- consent pass exists
- claim evidence pass exists

The first implementation should not expose publishing UI.

## QA Result Shape

- `formatPass`
- `evidencePass`
- `licencePass`
- `consentPass`
- `creativePass`
- `accessibilityPass`
- `publishGuardPass`
- `blockedReasons`
- `warnings`
- `nextActions`

## Acceptance Criteria

- QA can fail a creative package.
- Failed QA blocks client-ready export.
- Draft export can still exist with clear blocked status.
- Publish/ad-spend cannot be triggered from this module by default.
