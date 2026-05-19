# Product Spec: Agentic Marketing Agency

## Decision

Build the Agentic Marketing Agency as an organisation-scoped Synthex dashboard module. The first user-facing product is Facebook Video Creator for brand-awareness campaigns.

The product is not an ad launcher. It creates source-backed creative packages, evidence packs, QA reports, and export manifests. Publishing and spend remain blocked by default.

## Product Goal

Help a client team turn real business inputs into Facebook-ready video campaign packages that increase brand awareness without fabricating stories, claims, customer proof, or licensing status.

## Primary Users

- Agency operator: creates and reviews campaign packages.
- Client success manager: manages approvals, revisions, and handoff.
- Brand strategist: defines positioning, value proposition, and campaign angle.
- Creative producer: reviews scripts, storyboards, captions, thumbnails, and variants.
- Compliance reviewer: checks claims, consent, licences, and publishing gates.

## User Journey

1. Select or create a client brand.
2. Ingest source data:
   - product profile
   - value proposition
   - customer story
   - testimonials with consent
   - product images or footage
   - business proof points
   - competitor and market notes
3. Generate or edit buyer personas.
4. Produce a board campaign memo.
5. Generate Facebook video concepts.
6. Produce scripts, storyboards, shot lists, captions, thumbnails, and CTAs.
7. Search/recommend Artlist music in mock or live mode.
8. Generate HeyGen draft video only when provider credentials and consent gates pass.
9. Run creative, evidence, licence, consent, E-E-A-T, SEO/AEO/GEO, Meta, and Lighthouse QA.
10. Export Facebook-ready packages:
    - 9:16 Reels/Stories
    - 4:5 Feed
    - 1:1 Feed
    - 16:9 optional in-stream
11. Produce client-success handoff notes.
12. Track approvals and revisions.

## Core Objects

| Object | Purpose | Required Ownership |
| --- | --- | --- |
| ClientBrand | Organisation-scoped brand profile, mapped to or extending `BrandDNA`. | `organizationId` |
| ProductProfile | Source-backed product, offer, value, constraints, and proof points. | `organizationId`, `clientBrandId` |
| BuyerPersona | Target buyer segment, JTBD, pains, triggers, objections, and evidence. | `organizationId`, `clientBrandId` |
| MarketInsight | Category, competitor, trend, or customer insight with source. | `organizationId`, `clientBrandId` |
| CompetitorInsight | Competitor positioning, offer, creative, and gap notes with source. | `organizationId`, `clientBrandId` |
| CustomerStory | Real customer story or testimonial. | `organizationId`, `clientBrandId`, consent status |
| StoryEvidence | Source, consent, files, dates, and substantiation for a story. | `organizationId`, `customerStoryId` |
| AssetLicense | Licence record for image, video, audio, and generated assets. | `organizationId`, asset reference |
| CampaignBrief | Board-approved campaign problem, audience, strategy, and constraints. | `organizationId`, `clientBrandId` |
| FacebookVideoConcept | Core creative idea, hook, promise, and proof path. | `organizationId`, `campaignBriefId` |
| ScriptVariant | Script with hook, scenes, VO/caption text, claims, and evidence links. | `organizationId`, `conceptId` |
| Storyboard | Scene-by-scene visual plan. | `organizationId`, `conceptId` |
| ShotList | Required shots, assets, b-roll, avatar needs, and missing assets. | `organizationId`, `conceptId` |
| CaptionSet | Captions, primary text, headline, description, and CTA. | `organizationId`, `creativeVariantId` |
| ThumbnailConcept | Thumbnail frame, text, visual hierarchy, and proof basis. | `organizationId`, `creativeVariantId` |
| AudioRecommendation | Artlist track recommendation and licence metadata. | `organizationId`, `creativeVariantId` |
| CreativeVariant | Format-specific export candidate. | `organizationId`, `campaignBriefId` |
| ApprovalState | Internal/client review state and revision history. | `organizationId`, content reference |
| ExportPackage | JSON/media manifest and evidence bundle. | `organizationId`, `campaignBriefId` |
| PerformanceHypothesis | Expected creative mechanism and measurement plan. | `organizationId`, `campaignBriefId` |
| ClientSuccessHandoff | Delivery notes, review context, risks, and next actions. | `organizationId`, `campaignBriefId` |

## Non-Goals

- No Meta publishing in the first implementation.
- No ad spend management in the first implementation.
- No Artlist video-generation API calls.
- No fake customer stories, invented testimonials, or unverified claims.
- No public client portal until the internal workflow is stable.

## Acceptance Criteria

- Every generated campaign package starts from source data.
- Every factual claim has evidence or is blocked from client-ready export.
- Every customer story/image has consent status.
- Every media/audio asset has licence status.
- No client-side provider secrets.
- No publishing control is active without explicit server-side approval.
- The product can run in mock provider mode without Artlist or HeyGen credentials.
