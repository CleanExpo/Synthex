# API Surface Map - 2026-05-15

## Decision

The first implementation surface should be internal Synthex APIs and provider adapters, not direct client-side calls to Artlist, HeyGen, or Meta. All third-party credentials must remain server-side.

## External Provider Surface

### Artlist Enterprise API

Status: documented for music catalogue and downloads only.

Verified docs:

- Welcome: `https://developer.artlist.io/welcome`
- Authentication: `https://developer.artlist.io/authentication`
- General Terms: `https://developer.artlist.io/general-terms`
- Use Cases: `https://developer.artlist.io/use-cases`
- Full agent index: `https://developer.artlist.io/llms-full.txt`

Documented capabilities:

| Capability | Endpoint / Surface | Notes |
| --- | --- | --- |
| Server auth | OAuth 2.0 client credentials | Uses account-manager-provided `client_id` and `client_secret`; token expires after 1 hour. |
| Search songs | `GET /search/v1/song` | Query params include `page`, `query`, `categoryIds`, `vocalType`, `durationMin`, `durationMax`, `bpmMin`, `bpmMax`. 20 songs per request. |
| Get song | `GET /search/v1/song/{id}` | Returns song, artist, album, AAC URL, image URLs, waveform URL, duration, BPM, categories. |
| Get artist | `GET /search/v1/artist/{id}` | Returns artist metadata. |
| Get album | Documented in llms index | Should be verified again before implementation. |
| Download URL | `GET /download/v1/downloadable/{assetType}/{id}/{format}` | `assetType` enum includes `song`; `format` enum includes `mp3` and `wave`; response returns downloadable asset URL. |
| Rate limits | `/search`: 50 rpm; `/download`: 20 rpm; standard: 100 rpm | Must implement typed 429 handling, retry/backoff, and response header logging. |

Not documented:

- Artlist stock video search API.
- Artlist AI video generation API.
- Artlist Studio API for product workflows.

Implementation boundary:

- `lib/marketing-agency/artlist/auth.ts`: token provider.
- `lib/marketing-agency/artlist/client.ts`: server-only HTTP client.
- `lib/marketing-agency/artlist/search.ts`: song search/filter adapter.
- `lib/marketing-agency/artlist/recommend.ts`: maps creative mood/pacing/style to Artlist search params.
- `lib/marketing-agency/artlist/license-record.ts`: normalises licence/evidence metadata.
- `ManualArtlistStudioProvider`: no network calls; marks AI Studio/video as manual workflow pending official API.

### HeyGen API / CLI / MCP

Status: documented for v3 Video Agent, video generation, polling, download, webhooks, CLI, and MCP.

Verified docs:

- Quick Start: `https://developers.heygen.com/docs/quick-start`
- CLI: `https://developers.heygen.com/cli`
- MCP: `https://developers.heygen.com/mcp/overview`
- Webhooks: `https://developers.heygen.com/docs/webhooks`
- Usage Limits: `https://developers.heygen.com/docs/usage-limits`

Documented capabilities:

| Capability | Endpoint / Surface | Notes |
| --- | --- | --- |
| Prompt to video | `POST /v3/video-agents` | Uses `X-Api-Key`; returns `session_id`, `status`, `video_id`, `created_at`. |
| Poll video | `GET /v3/videos/{video_id}` | Async statuses include completed/failed; completed includes `video_url`, `thumbnail_url`, `duration`. |
| Callback | `callback_url` on creation | One-off notification per video. |
| Webhook endpoints | `/v3/webhooks/endpoints` | Register HTTPS endpoints; verify with HMAC-SHA256 over raw body. |
| CLI | `heygen video-agent create`, `heygen video get`, `heygen video download` | Structured JSON output by default; suitable for agent/CI workflows. |
| MCP | hosted endpoint `https://mcp.heygen.com/mcp/v1/` | OAuth-based access to account credits and video tools. |
| Limits | 10 concurrent pay-as-you-go jobs; Video Agent prompt 1-10,000 chars | 429 includes `Retry-After`; default output 1080p; 16:9 or 9:16 documented. |

Implementation boundary:

- `lib/marketing-agency/heygen/client.ts`: server-only API client.
- `lib/marketing-agency/heygen/video-agent.ts`: prompt-to-video draft provider.
- `lib/marketing-agency/heygen/poll.ts`: async status polling.
- `lib/marketing-agency/heygen/webhook.ts`: webhook/callback verification and job updates.
- `lib/marketing-agency/heygen/download.ts`: downloaded asset manifest writer.
- `MockHeyGenProvider`: deterministic dev/test output.

Guardrails:

- No use of a real person's likeness without explicit consent evidence.
- Draft-only until client approval.
- Cost and concurrency guardrails required before real provider enablement.

### Meta / Facebook Marketing And Creative Surface

Status: existing repo has Meta/Facebook OAuth, webhook, social posting, and publish queue code. New marketing-agency surface must not publish or spend by default.

Verified docs:

- Marketing API entry: `https://developers.facebook.com/docs/marketing-api/`
- Ad Creative reference: `https://developers.facebook.com/docs/marketing-api/reference/ad-creative/`
- Ads Guide entry: `https://www.facebook.com/business/ads-guide`
- Video ads overview: `https://www.facebook.com/business/ads/video-ad-format`

Repo surfaces:

| Surface | File | Current Use |
| --- | --- | --- |
| Meta OAuth | `lib/oauth/providers/meta.ts` | OAuth endpoints and page account discovery for Facebook/Instagram. |
| Facebook social post API | `app/api/social/facebook/post/route.ts` | Creates/schedules Facebook posts via Graph API. |
| Publish queue | `lib/publish/publishQueue.ts` | Platform publishing orchestration. |
| Facebook adapter | `lib/publish/platformAdapters/facebook.ts` | Existing platform adapter. |
| Safety checks | `lib/publish/safetyChecks.ts` | Pre-publish safety gate. |
| Social webhooks | `app/api/webhooks/[platform]/route.ts`, `app/api/webhooks/social/route.ts` | Meta webhook verification and handling. |

Implementation boundary:

- `lib/marketing-agency/meta/specs.ts`: static placement/export requirements.
- `lib/marketing-agency/meta/creative-checks.ts`: local validation, no API call required.
- `lib/marketing-agency/meta/export.ts`: JSON + media manifest export.
- `lib/marketing-agency/meta/draft-ad-payload.ts`: draft payload builder only.

Guardrails:

- Disable publishing controls by default.
- Require server-side `APPROVED_TO_PUBLISH_META_ADS=true` before any future publishing or paid campaign launch.
- Require explicit user/org ownership, Meta credential presence, and compliance pass before any future publish path.

### Google Search / SEO / AEO / GEO

Verified docs:

- SEO Starter Guide: `https://developers.google.com/search/docs/fundamentals/seo-starter-guide`
- AI features: `https://developers.google.com/search/docs/appearance/ai-features`
- Helpful content: `https://developers.google.com/search/docs/fundamentals/creating-helpful-content`
- Structured data: `https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data`

Repo surfaces:

- `lib/seo/*`
- `lib/geo/*`
- `lib/eeat/*`
- `lib/authority/*`
- `app/dashboard/seo/*`
- `app/dashboard/geo/*`
- `app/dashboard/eeat/page.tsx`
- `app/dashboard/authority/page.tsx`

Implementation boundary:

- New campaign intelligence should reuse existing SEO/GEO/E-E-A-T scoring where practical.
- Structured data recommendations must match visible campaign/landing content.
- AI features should be treated as answer-readiness and evidence quality, not a separate optimisation hack.

### Lighthouse / Core Web Vitals

Verified docs:

- Lighthouse overview: `https://developer.chrome.com/docs/lighthouse/overview`
- Web Vitals: `https://web.dev/articles/vitals`

Repo surface:

- `lighthouserc.js`
- `playwright.config.ts`
- `tests/e2e/*`

Current local Lighthouse targets:

- Performance >= 0.90
- Accessibility >= 0.90
- Best Practices >= 0.90
- SEO >= 0.90
- FCP < 2000 ms
- LCP < 2500 ms
- CLS < 0.1
- TBT < 300 ms
- Speed Index < 3000 ms

## Internal Synthex API Surface To Add Later

No code was added in Phase 0. Recommended API shape for later phases:

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/marketing-agency/brands` | GET/POST | user | List/create organisation-scoped client brands, mapped to or extending `BrandDNA`. |
| `/api/marketing-agency/personas` | GET/POST/PATCH | user | Generate/edit buyer personas with source and confidence metadata. |
| `/api/marketing-agency/stories` | GET/POST/PATCH | user | Store customer stories, consent status, and evidence references. |
| `/api/marketing-agency/campaigns` | GET/POST | user | Create Facebook brand-awareness campaign briefs. |
| `/api/marketing-agency/campaigns/[id]` | GET/PATCH | user | Retrieve/update campaign package. |
| `/api/marketing-agency/campaigns/[id]/generate` | POST | user | Run orchestrator to produce memo, concepts, scripts, storyboard, and QA. |
| `/api/marketing-agency/artlist/search` | POST | user | Server-side Artlist search or mock search. |
| `/api/marketing-agency/heygen/draft` | POST | user | Server-side HeyGen or mock draft generation. |
| `/api/marketing-agency/meta/export` | POST | user | Draft/export package creation. No publish. |
| `/api/marketing-agency/qa/[id]` | GET/POST | user | Claim, consent, licence, a11y, Meta creative, and Lighthouse QA reports. |

Every route must use Supabase-authenticated user context, organisation scoping, Zod validation for mutations, and server-only provider calls.

## Environment Variables To Add Later

Do not add to `.env.example` until implementation begins.

Recommended names:

- `ARTLIST_CLIENT_ID`
- `ARTLIST_CLIENT_SECRET`
- `ARTLIST_API_BASE_URL`
- `HEYGEN_API_KEY`
- `HEYGEN_WEBHOOK_SECRET`
- `APPROVED_TO_PUBLISH_META_ADS`
- `MARKETING_AGENCY_PROVIDER_MODE` with values `mock | live`

Secrets must be server-only. No `NEXT_PUBLIC_` prefix for provider keys, client secrets, tokens, or customer data.
