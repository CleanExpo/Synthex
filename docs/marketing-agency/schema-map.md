# Marketing Agency Schema Map

## Decision

Use additive, organisation-scoped models for the Marketing Agency product. Reuse existing Synthex models where they already cover the domain, and add only the records needed for evidence, licensing, creative packages, provider jobs, and export history.

No migration has been created yet. This document is the pre-migration schema design.

## Existing Models To Reuse

| Existing Model | Use |
| --- | --- |
| `Organization` | Tenant boundary and ownership. |
| `User` | Creator, reviewer, approver, and provider action actor. |
| `BrandDNA` | Starting point for client brand identity and voice. |
| `Campaign` | Existing campaign container where compatible. |
| `Persona` | Existing persona storage where compatible. |
| `VideoGeneration` | Existing video generation record where generated video assets are created. |
| `ApprovalRequest` | Existing approval workflow for client/internal review. |
| `WorkflowExecution` | Existing orchestrated run container. |
| `StepExecution` | Existing agent/specialist step log and confidence storage. |
| `APICredential` | Existing encrypted BYOK/provider credential storage where appropriate. |
| `VaultSecret` | Existing organisation-scoped secret storage where appropriate. |
| `PlatformConnection` | Existing Meta/Facebook social credential pattern. |

## Proposed New Models

### MarketingClientBrand

Purpose: product-specific wrapper around `BrandDNA` and campaign defaults.

Key fields:

- `id`
- `organizationId`
- `brandDnaId?`
- `name`
- `websiteUrl?`
- `industry?`
- `positioningSummary?`
- `voiceProfile Json`
- `visualProfile Json`
- `status`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId]`
- `[organizationId, name]`

### ProductProfile

Purpose: source-backed product or offer profile.

Key fields:

- `id`
- `organizationId`
- `clientBrandId`
- `name`
- `description`
- `valueProposition`
- `features Json`
- `proofPoints Json`
- `constraints Json`
- `sourceRefs Json`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId]`
- `[organizationId, clientBrandId]`

### BuyerPersonaProfile

Purpose: marketing-agency-specific persona with rationale and source traceability. Can reference existing `Persona`.

Key fields:

- `id`
- `organizationId`
- `clientBrandId`
- `personaId?`
- `name`
- `segment`
- `jtbd Json`
- `painPoints Json`
- `motivators Json`
- `objections Json`
- `behaviouralDrivers Json`
- `sourceRefs Json`
- `confidenceScore Float?`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId]`
- `[organizationId, clientBrandId]`

### MarketInsightRecord

Purpose: market, competitor, query, or category insight with source.

Key fields:

- `id`
- `organizationId`
- `clientBrandId`
- `type`
- `title`
- `summary`
- `sourceUrl?`
- `sourceType`
- `capturedAt`
- `metadata Json`
- `createdBy`
- `createdAt`

Indexes:

- `[organizationId, clientBrandId]`
- `[organizationId, type]`

### CustomerStory

Purpose: real story or testimonial container.

Key fields:

- `id`
- `organizationId`
- `clientBrandId`
- `title`
- `summary`
- `sourceType`
- `sourceRef?`
- `customerDisplayName?`
- `consentStatus`
- `consentScope Json`
- `containsLikeness Boolean`
- `containsSensitiveData Boolean`
- `status`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId, clientBrandId]`
- `[organizationId, consentStatus]`

### StoryEvidence

Purpose: source and substantiation record for a customer story or claim.

Key fields:

- `id`
- `organizationId`
- `customerStoryId?`
- `claimId?`
- `evidenceType`
- `sourceUrl?`
- `storagePath?`
- `evidenceText?`
- `consentRecordId?`
- `reviewStatus`
- `reviewedBy?`
- `reviewedAt?`
- `createdAt`

Indexes:

- `[organizationId]`
- `[organizationId, customerStoryId]`
- `[organizationId, reviewStatus]`

### ConsentRecord

Purpose: explicit permission record for story, image, voice, likeness, or testimonial use.

Key fields:

- `id`
- `organizationId`
- `customerStoryId?`
- `subjectName?`
- `consentType`
- `status`
- `scope Json`
- `evidenceUrl?`
- `storagePath?`
- `grantedAt?`
- `expiresAt?`
- `revokedAt?`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId]`
- `[organizationId, status]`
- `[organizationId, customerStoryId]`

### MarketingAssetLicense

Purpose: licence and usage-rights record for media/audio/generated assets.

Key fields:

- `id`
- `organizationId`
- `assetType`
- `provider`
- `providerAssetId?`
- `assetUrl?`
- `storagePath?`
- `licenceType?`
- `licenceStatus`
- `licenceEvidenceUrl?`
- `licenceEvidenceText?`
- `allowedUses Json`
- `restrictions Json`
- `expiresAt?`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId]`
- `[organizationId, provider]`
- `[organizationId, licenceStatus]`

### MarketingCampaignBrief

Purpose: campaign brief and board memo root.

Key fields:

- `id`
- `organizationId`
- `clientBrandId`
- `productProfileId?`
- `buyerPersonaId?`
- `campaignId?`
- `objective`
- `awarenessStage`
- `brief Json`
- `boardMemo Json`
- `weakestAssumption?`
- `status`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId]`
- `[organizationId, clientBrandId]`
- `[organizationId, status]`

### FacebookVideoConcept

Purpose: creative concept attached to a campaign brief.

Key fields:

- `id`
- `organizationId`
- `campaignBriefId`
- `title`
- `hook`
- `conceptSummary`
- `storyArc Json`
- `proofRefs Json`
- `risks Json`
- `confidenceScore Float?`
- `status`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId, campaignBriefId]`
- `[organizationId, status]`

### CreativeVariant

Purpose: format-specific script/storyboard/export candidate.

Key fields:

- `id`
- `organizationId`
- `campaignBriefId`
- `conceptId?`
- `format`
- `script Json`
- `storyboard Json`
- `shotList Json`
- `captionSet Json`
- `thumbnailConcept Json`
- `cta Json`
- `claimRefs Json`
- `assetRefs Json`
- `status`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId, campaignBriefId]`
- `[organizationId, format]`
- `[organizationId, status]`

### CreativeClaim

Purpose: claim extracted from campaign brief, script, captions, or thumbnail.

Key fields:

- `id`
- `organizationId`
- `campaignBriefId`
- `creativeVariantId?`
- `claimText`
- `claimType`
- `riskLevel`
- `evidenceStatus`
- `evidenceRefs Json`
- `reviewStatus`
- `reviewedBy?`
- `reviewedAt?`
- `createdAt`

Indexes:

- `[organizationId, campaignBriefId]`
- `[organizationId, evidenceStatus]`
- `[organizationId, reviewStatus]`

### ProviderJob

Purpose: Artlist, HeyGen, Meta draft export, or other provider activity log.

Key fields:

- `id`
- `organizationId`
- `campaignBriefId?`
- `creativeVariantId?`
- `provider`
- `providerMode`
- `providerJobId?`
- `status`
- `requestSummary Json`
- `responseSummary Json`
- `errorMessage?`
- `costEstimate Json?`
- `startedAt?`
- `completedAt?`
- `createdBy`
- `createdAt`

Indexes:

- `[organizationId, provider]`
- `[organizationId, status]`
- `[organizationId, campaignBriefId]`

### MarketingQaReport

Purpose: consolidated QA pass/fail record.

Key fields:

- `id`
- `organizationId`
- `campaignBriefId`
- `creativeVariantId?`
- `reportType`
- `status`
- `score Float?`
- `checks Json`
- `blockedReasons Json`
- `warnings Json`
- `createdBy`
- `createdAt`

Indexes:

- `[organizationId, campaignBriefId]`
- `[organizationId, reportType]`
- `[organizationId, status]`

### ExportPackage

Purpose: final JSON/media/evidence export manifest and revision history root.

Key fields:

- `id`
- `organizationId`
- `campaignBriefId`
- `approvalRequestId?`
- `version Int`
- `status`
- `manifest Json`
- `evidencePack Json`
- `licencePack Json`
- `consentPack Json`
- `storagePath?`
- `createdBy`
- `createdAt`

Indexes:

- `[organizationId, campaignBriefId]`
- `[organizationId, status]`
- unique `[campaignBriefId, version]`

### ClientSuccessHandoff

Purpose: review, delivery, revision, and performance follow-up record.

Key fields:

- `id`
- `organizationId`
- `campaignBriefId`
- `approvalRequestId?`
- `status`
- `handoffNotes Json`
- `revisionSummary Json`
- `clientDecisionsNeeded Json`
- `measurementPlan Json`
- `createdBy`
- `createdAt`
- `updatedAt`

Indexes:

- `[organizationId, campaignBriefId]`
- `[organizationId, status]`

## Ownership Matrix

| Model | Must Include `organizationId` | User Scope | Notes |
| --- | --- | --- | --- |
| MarketingClientBrand | Yes | creator/reviewer only | Wraps or references `BrandDNA`. |
| ProductProfile | Yes | creator | Never global. |
| BuyerPersonaProfile | Yes | creator | May reference existing `Persona`. |
| MarketInsightRecord | Yes | creator | Source-backed only. |
| CustomerStory | Yes | creator/reviewer | Consent-gated. |
| StoryEvidence | Yes | reviewer | Can reference story or claim. |
| ConsentRecord | Yes | reviewer | Revocation must block export. |
| MarketingAssetLicense | Yes | reviewer | Licence pass required for export. |
| MarketingCampaignBrief | Yes | creator | Campaign root. |
| FacebookVideoConcept | Yes | generated | Derived from brief. |
| CreativeVariant | Yes | generated | Format-specific. |
| CreativeClaim | Yes | generated/reviewer | Evidence pass required. |
| ProviderJob | Yes | system | No secrets stored in payload summaries. |
| MarketingQaReport | Yes | system/reviewer | Pass/fail gate. |
| ExportPackage | Yes | creator/system | Versioned. |
| ClientSuccessHandoff | Yes | CSM | Required before approval. |

## Security And RLS Requirements

If Supabase RLS policies are added, each table must follow the current organisation membership pattern:

- `SELECT`: user must belong to `organizationId`.
- `INSERT`: user must belong to `organizationId`.
- `UPDATE`: user must belong to `organizationId`; approval/status transitions may require role checks.
- `DELETE`: avoid hard delete; prefer soft status or archive where product allows.

Provider payload rules:

- Store summaries, not raw secrets.
- Never persist Artlist client secret, HeyGen API key, Meta access token, or customer PII in provider job summaries.
- Store encrypted provider credentials only through existing credential/vault patterns.

## Migration Rules

- Additive only.
- All new columns nullable or defaulted.
- No drops, renames, or type changes.
- Review generated SQL before execution.
- Run `npx prisma validate` before schema execution.
- Add indexes for every `organizationId` query path.

## Test Plan

Minimum Phase 2 tests:

- organisation A cannot read organisation B campaign brief
- organisation A cannot read organisation B story evidence
- unconsented customer story blocks export
- unlicensed asset blocks export
- unsupported claim blocks client-ready export
- revoked consent invalidates export readiness
- provider job summaries do not expose secrets
- export package version increments

## Open Questions Before Migration

- Whether `MarketingClientBrand` should be separate or absorbed into `BrandDNA`.
- Whether `BuyerPersonaProfile` should extend existing `Persona` or replace it for this module.
- Whether file evidence should use existing media library/storage model if one is active in production.
- Whether `Campaign` should be the parent record or `MarketingCampaignBrief` should be the parent with optional `campaignId`.
