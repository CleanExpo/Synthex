# Asset Licensing Policy

## Decision

No image, video, audio, avatar, voice, or generated asset can be exported as client-ready without a licence or rights record.

## Asset Classes

| Asset Type | Allowed Source | Required Record |
| --- | --- | --- |
| Client image/video | Client upload or connected library | Ownership or usage permission. |
| Customer image/video | Client upload with customer consent | Consent and usage permission. |
| Artlist music | Documented Artlist API or manual enterprise workflow | Track ID, artist, source URL, licence evidence. |
| HeyGen generated video | HeyGen provider or mock provider | Provider job ID, prompt, usage rights, consent if likeness is involved. |
| Generated image/video | Approved provider | Prompt, provider, generation ID, usage rights. |
| Stock media | Approved provider | Provider asset ID and licence terms. |

## Licence Record Fields

- `organizationId`
- `assetId`
- `assetType`
- `provider`
- `providerAssetId`
- `sourceUrl`
- `licenceType`
- `licenceStatus`: `unknown | pending | licensed | rejected | expired`
- `licenceEvidenceUrl`
- `licenceEvidenceText`
- `allowedUses`
- `restrictions`
- `expiresAt`
- `createdBy`
- `createdAt`
- `updatedAt`

## Artlist Rules

- Use only documented music catalogue/search/download endpoints.
- Do not scrape Artlist.
- Do not infer video, footage, or AI Studio API rights.
- Persist track metadata before export:
  - song ID
  - song name
  - artist
  - album
  - duration
  - BPM
  - categories
  - API source URL or documented download URL
  - licence evidence
- If credentials are missing, use mock recommendations only and mark licence status as `pending`.

## Export Blocking Rules

Block client-ready export when:

- licence status is `unknown`, `pending`, `rejected`, or `expired`
- source URL is missing for third-party media
- provider asset ID is missing for provider media
- usage rights do not include advertising/marketing use
- restrictions conflict with Facebook placement or client industry

## Acceptance Criteria

- Every selected asset has a licence record.
- Mock assets are clearly marked as non-production.
- Export package includes an asset licence pack.
- Unlicensed assets cannot be present in client-ready export.
