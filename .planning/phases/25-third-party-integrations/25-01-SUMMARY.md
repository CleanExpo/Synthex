---
phase: 25-third-party-integrations
plan: 01
subsystem: backend
tags: [integrations, canva, buffer, zapier, webhooks, api-routes, hooks]

requires:
  - phase: 24-02
    provides: Report builder page route and navigation integration

provides:
  - lib/integrations/ service module with Canva, Buffer, Zapier services
  - Third-party integration API routes (list, connect, disconnect, config)
  - useThirdPartyIntegrations React hook for UI consumption
  - Zapier inbound webhook receiver with HMAC-SHA256 verification

affects: [integrations, webhooks, hooks]

tech-stack:
  added: []
  patterns: [integration-service-factory, provider-credential-validation, fetch-useState-hook, webhook-signature-verification]

key-files:
  created: [lib/integrations/types.ts, lib/integrations/canva-service.ts, lib/integrations/buffer-service.ts, lib/integrations/zapier-service.ts, lib/integrations/index.ts, app/api/integrations/third-party/route.ts, app/api/integrations/third-party/[provider]/route.ts, app/api/integrations/third-party/[provider]/config/route.ts, hooks/use-third-party-integrations.ts, app/api/webhooks/zapier/route.ts]
  modified: []

key-decisions:
  - "PlatformConnection model reused for all three providers with metadata JSON for provider-specific config"
  - "Factory pattern (createIntegrationService) returns typed union requiring validateCredentials on all providers"
  - "Zapier webhook receiver uses its own signature verification rather than the platform webhook handler, since Zapier is an inbound automation source"

patterns-established:
  - "Integration service factory: createIntegrationService(provider, credentials) returns provider-specific service"
  - "Provider config route pattern: GET returns registry config + user overrides, PUT merges into metadata.userConfig"

issues-created: []

duration: ~15 min
completed: 2026-02-18
---

# Plan 25-01 Summary: Backend Service Layer + API Routes for Third-Party Integrations

**Integration services, API routes, React hook, and Zapier webhook receiver for Canva, Buffer, and Zapier third-party connections**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3 auto
- **Files created:** 10
- **Files modified:** 0

## Accomplishments

- Created `lib/integrations/types.ts` with IntegrationProvider, IntegrationCredentials, IntegrationStatus types and INTEGRATION_REGISTRY for all 3 providers
- Created `lib/integrations/canva-service.ts` with validateCredentials, listDesigns, importDesign, getDesignUrl, disconnect methods against Canva Connect API
- Created `lib/integrations/buffer-service.ts` with validateCredentials, getProfiles, getQueue, addToQueue, getAnalytics methods against Buffer API
- Created `lib/integrations/zapier-service.ts` with validateCredentials, validateWebhookUrl, registerHook, unregisterHook, listHooks, testHook methods for webhook subscriptions
- Created `lib/integrations/index.ts` with createIntegrationService factory, getIntegrationConfig helper, isValidProvider type guard, SUPPORTED_PROVIDERS array
- Created GET /api/integrations/third-party listing all providers with connection status
- Created POST/GET/DELETE /api/integrations/third-party/[provider] for connect, status, and disconnect
- Created GET/PUT /api/integrations/third-party/[provider]/config for provider settings
- Created `hooks/use-third-party-integrations.ts` with connect, disconnect, refresh, updateConfig actions (fetch+useState pattern)
- Created POST /api/webhooks/zapier with HMAC-SHA256 signature verification and event mapping to internal WebhookEventType

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/integrations/ service module** - `915f950` (feat)
2. **Task 2: Create third-party integration API routes** - `f285e70` (feat)
3. **Task 3: Create useThirdPartyIntegrations hook and Zapier webhook receiver** - `9d8e7cc` (feat)
4. **Bug fix: Add missing validateCredentials to ZapierService** - `ebd7069` (fix)

## Files Created/Modified

- `lib/integrations/types.ts` - Provider types, credential/status interfaces, INTEGRATION_REGISTRY
- `lib/integrations/canva-service.ts` - Canva Connect API service (design listing, import, export)
- `lib/integrations/buffer-service.ts` - Buffer API service (profiles, queue, analytics)
- `lib/integrations/zapier-service.ts` - Zapier webhook subscription management
- `lib/integrations/index.ts` - Factory function, type guards, unified exports
- `app/api/integrations/third-party/route.ts` - GET all integrations with status
- `app/api/integrations/third-party/[provider]/route.ts` - POST/GET/DELETE per provider
- `app/api/integrations/third-party/[provider]/config/route.ts` - GET/PUT provider config
- `hooks/use-third-party-integrations.ts` - React hook with fetch+useState pattern
- `app/api/webhooks/zapier/route.ts` - Zapier inbound webhook with signature verification

## Decisions Made

- Reuse PlatformConnection model for all three providers (no schema migration needed)
- Factory function returns union type, requiring all services to implement validateCredentials
- Zapier webhook uses dedicated signature verification (ZAPIER_WEBHOOK_SECRET env var) rather than the existing platform webhook handler

## Deviations from Plan

- **Rule 1 (auto-fix bug):** ZapierService was missing `validateCredentials()` method required by the factory union type used in the API route. Added the method and committed as a separate fix (`ebd7069`).

## Verification

- `npm run type-check` passes with no new errors (only pre-existing errors in lib/prisma.ts, lib/video/, with-turbopack-app)
- All 10 new files exist and compile cleanly
- lib/integrations/index.ts exports factory function and all types
- API routes use Prisma (not Supabase client) and JWT auth via getUserIdFromCookies
- Hook follows fetch + useState pattern (no SWR/TanStack Query)
- Zapier webhook validates HMAC-SHA256 signatures before processing

## Issues Encountered

None beyond the auto-fixed missing method.

## Next Phase Readiness

- Plan 25-01 backend foundation complete
- Ready for Plan 25-02: Integration settings UI and connection flow components

---
*Phase: 25-third-party-integrations*
*Completed: 2026-02-18*
