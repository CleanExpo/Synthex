# Facebook Video Creator Spec

## Decision

Facebook Video Creator produces format-ready draft creative packages. It does not publish, boost, create campaigns, or spend.

## Route Plan

Preferred dashboard routes:

- `/dashboard/marketing-agency`
- `/dashboard/marketing-agency/facebook-video`
- `/dashboard/marketing-agency/campaigns/[id]`
- `/dashboard/marketing-agency/assets`
- `/dashboard/marketing-agency/personas`

Preferred API routes:

- `/api/marketing-agency/campaigns`
- `/api/marketing-agency/campaigns/[id]`
- `/api/marketing-agency/campaigns/[id]/generate`
- `/api/marketing-agency/artlist/search`
- `/api/marketing-agency/heygen/draft`
- `/api/marketing-agency/meta/export`
- `/api/marketing-agency/qa/[id]`

## Screen Workflow

1. Brand selector.
2. Product value brief.
3. Buyer persona builder.
4. Story/evidence uploader.
5. Campaign brief form.
6. Board memo panel.
7. Script variants.
8. Storyboard timeline.
9. Artlist track picker.
10. HeyGen draft panel.
11. Format preview.
12. Creative scorecard.
13. QA checklist.
14. Export package.
15. Client handoff.

## Components

- `AgencyBoardPanel`
- `ClientBrandSelector`
- `ProductValueBrief`
- `PersonaBuilder`
- `StoryEvidenceUploader`
- `ConsentStatusBadge`
- `FacebookVideoBriefForm`
- `ScriptVariantCard`
- `StoryboardTimeline`
- `ArtlistTrackPicker`
- `HeyGenDraftPanel`
- `CreativeScorecard`
- `MetaFormatPreview`
- `ExportPackagePanel`
- `ClientSuccessHandoff`

## Supported Exports

| Format | Use | Required Checks |
| --- | --- | --- |
| 9:16 | Reels/Stories | Safe-area captions, early brand cue, vertical framing. |
| 4:5 | Feed | Primary message above fold, readable captions, CTA. |
| 1:1 | Feed | Cropped visual hierarchy, brand cue, CTA. |
| 16:9 | Optional in-stream | Landscape composition and caption readability. |

## Creative Package Contents

- campaign brief
- board memo
- target persona
- concept rationale
- script variants
- storyboard
- shot list
- captions
- thumbnail concept
- CTA recommendation
- Artlist audio recommendation
- HeyGen draft reference where available
- evidence pack
- asset licence pack
- consent pack
- Meta creative QA report
- SEO/AEO/GEO rationale
- E-E-A-T matrix
- export manifest
- client handoff notes

## UI States

Every major panel must support:

- empty state
- loading state
- validation error state
- provider credential missing state
- blocked state
- draft state
- client-ready state

## Publishing Gate

Publishing controls must be hidden or disabled unless all are true:

- server-side `APPROVED_TO_PUBLISH_META_ADS=true`
- Meta credentials exist
- organisation owns the campaign
- approval status is approved
- licence pass
- consent pass
- claim evidence pass
- compliance pass

The first implementation should keep publishing absent, not merely disabled.

## Acceptance Criteria

- A user can create a campaign package in mock provider mode.
- Draft creative variants render for all required formats.
- Unsupported claims are visible as blocked.
- Unlicensed or unconsented assets cannot be added to export.
- Missing Artlist/HeyGen credentials do not block script/storyboard/export work.
- No provider secret is present in browser-visible data.
